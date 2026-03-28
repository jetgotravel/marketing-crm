-- Phase 3: Two-Way Email Sync
-- ============================================================

-- ============================================================
-- PART A: EMAILS TABLE
-- ============================================================

CREATE TABLE emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  sequence_id uuid REFERENCES sequences(id) ON DELETE SET NULL,
  step_id uuid REFERENCES sequence_steps(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('sent','received','manual_reply')),
  subject text,
  body_snippet text,
  gmail_message_id text NOT NULL,
  gmail_thread_id text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_emails_tenant ON emails(tenant_id);
CREATE INDEX idx_emails_contact ON emails(tenant_id, contact_id);
CREATE INDEX idx_emails_thread ON emails(gmail_thread_id);
CREATE INDEX idx_emails_user ON emails(tenant_id, user_id);
CREATE INDEX idx_emails_direction ON emails(tenant_id, direction);
CREATE UNIQUE INDEX idx_emails_gmail_message_unique ON emails(gmail_message_id);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY emails_isolation ON emails
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

-- ============================================================
-- PART B: GMAIL HISTORY ID ON USERS (for incremental sync)
-- ============================================================

ALTER TABLE users
  ADD COLUMN gmail_history_id text;

-- ============================================================
-- PART C: EXPAND ACTIVITY TYPES (add email_bounced)
-- ============================================================

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type IN (
    'email_sent','email_opened','email_replied',
    'note_added','status_changed','enriched',
    'sequence_enrolled','sequence_completed','sequence_step_sent',
    'deal_created','deal_stage_changed',
    'contact_created','company_created',
    'list_added','list_removed',
    'gmail_sent','gmail_failed',
    'email_bounced'
  ));

-- ============================================================
-- PART D: ADD 'bounced' TO CONTACTS STATUS ENUM
-- ============================================================

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_status_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_status_check
  CHECK (status IN ('new','contacted','replied','qualified','converted','lost','bounced'));
