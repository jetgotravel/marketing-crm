-- Phase 1: Users + Company Linking + Send Queue
-- ============================================================

-- ============================================================
-- TENANT GOOGLE OAUTH CREDENTIALS (per-tenant)
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN google_client_id text,
  ADD COLUMN google_client_secret text;

-- ============================================================
-- PART A: USERS TABLE + ENROLLMENT SENDER
-- ============================================================

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  email text NOT NULL,
  name text,
  role text DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  gmail_connected boolean DEFAULT false,
  google_refresh_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_isolation ON users
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sender on enrollments — which user's Gmail sends the emails
ALTER TABLE sequence_enrollments
  ADD COLUMN sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_enrollments_sender ON sequence_enrollments(sender_user_id);

-- ============================================================
-- PART B: CONTACT-COMPANY LINKING + COMPANY ENHANCEMENTS
-- ============================================================

-- Direct company link on contacts (primary company)
ALTER TABLE contacts
  ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE contacts
  ADD COLUMN is_placeholder boolean DEFAULT false;

CREATE INDEX idx_contacts_company ON contacts(company_id);

-- General inbox email for companies
ALTER TABLE companies
  ADD COLUMN primary_email text;

-- ============================================================
-- PART C: SEND QUEUE + SEQUENCE SETTINGS
-- ============================================================

CREATE TABLE send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  enrollment_id uuid NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_send_queue_pending ON send_queue(scheduled_for)
  WHERE status = 'pending';
CREATE INDEX idx_send_queue_tenant ON send_queue(tenant_id);
CREATE INDEX idx_send_queue_user_day ON send_queue(user_id, created_at)
  WHERE status IN ('sent','pending','processing');
CREATE INDEX idx_send_queue_enrollment ON send_queue(enrollment_id);

ALTER TABLE send_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY send_queue_isolation ON send_queue
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

-- Sequence automation settings
ALTER TABLE sequences
  ADD COLUMN send_window_start time DEFAULT '09:00',
  ADD COLUMN send_window_end time DEFAULT '17:00',
  ADD COLUMN skip_weekends boolean DEFAULT true,
  ADD COLUMN daily_send_limit integer DEFAULT 50,
  ADD COLUMN cooldown_days integer DEFAULT 30;

-- Expand activity types for gmail events
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type IN (
    'email_sent','email_opened','email_replied',
    'note_added','status_changed','enriched',
    'sequence_enrolled','sequence_completed','sequence_step_sent',
    'deal_created','deal_stage_changed',
    'contact_created','company_created',
    'list_added','list_removed',
    'gmail_sent','gmail_failed'
  ));

-- ============================================================
-- UPDATED SEQUENCE PROCESSOR: populate send_queue
-- ============================================================

CREATE OR REPLACE FUNCTION populate_send_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
  selected_variant record;
  next_step record;
  step_delay integer;
  sent_today integer;
BEGIN
  FOR rec IN
    SELECT
      se.id AS enrollment_id,
      se.sequence_id,
      se.contact_id,
      se.current_step_order,
      se.sender_user_id,
      s.tenant_id,
      s.daily_send_limit
    FROM sequence_enrollments se
    JOIN sequences s ON s.id = se.sequence_id
    WHERE se.status = 'active'
      AND se.next_step_at <= now()
      AND se.sender_user_id IS NOT NULL
    FOR UPDATE OF se SKIP LOCKED
  LOOP
    -- Pick a random variant at this step_order
    SELECT * INTO selected_variant
    FROM sequence_steps
    WHERE sequence_id = rec.sequence_id
      AND step_order = rec.current_step_order
    ORDER BY random()
    LIMIT 1;

    -- No step found — mark completed
    IF selected_variant IS NULL THEN
      UPDATE sequence_enrollments
      SET status = 'completed', updated_at = now()
      WHERE id = rec.enrollment_id;

      INSERT INTO activities (tenant_id, contact_id, activity_type, metadata)
      VALUES (rec.tenant_id, rec.contact_id, 'sequence_completed',
        jsonb_build_object('sequence_id', rec.sequence_id, 'enrollment_id', rec.enrollment_id));
      CONTINUE;
    END IF;

    -- Check daily send limit
    IF rec.daily_send_limit IS NOT NULL AND rec.daily_send_limit > 0 THEN
      SELECT count(*) INTO sent_today
      FROM send_queue
      WHERE user_id = rec.sender_user_id
        AND status IN ('sent','pending','processing')
        AND created_at >= date_trunc('day', now());
      IF sent_today >= rec.daily_send_limit THEN
        CONTINUE;
      END IF;
    END IF;

    -- Skip if already queued for this enrollment+step
    IF EXISTS (
      SELECT 1 FROM send_queue
      WHERE enrollment_id = rec.enrollment_id
        AND step_id = selected_variant.id
        AND status IN ('pending','processing','sent')
    ) THEN
      CONTINUE;
    END IF;

    -- Insert into send queue
    INSERT INTO send_queue (tenant_id, enrollment_id, step_id, user_id, contact_id, status, scheduled_for)
    VALUES (rec.tenant_id, rec.enrollment_id, selected_variant.id,
            rec.sender_user_id, rec.contact_id, 'pending', now());

    -- Advance enrollment to next step
    SELECT ss.step_order, ss.delay_days INTO next_step
    FROM sequence_steps ss
    WHERE ss.sequence_id = rec.sequence_id
      AND ss.step_order > rec.current_step_order
    ORDER BY ss.step_order ASC
    LIMIT 1;

    IF next_step IS NULL THEN
      -- Last step — will be completed after send succeeds
      UPDATE sequence_enrollments
      SET next_step_at = NULL, updated_at = now()
      WHERE id = rec.enrollment_id;
    ELSE
      step_delay := coalesce(next_step.delay_days, 0);
      UPDATE sequence_enrollments
      SET current_step_order = next_step.step_order,
          next_step_at = now() + (step_delay || ' days')::interval,
          updated_at = now()
      WHERE id = rec.enrollment_id;
    END IF;
  END LOOP;
END;
$$;

-- Note: populate_send_queue() is called by Vercel Cron (vercel.json)
-- via the /api/v1/send-queue/process endpoint, not pg_cron.
