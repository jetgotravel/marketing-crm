-- marketing-crm initial schema
-- All tables have tenant_id scoping + RLS

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  key text UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  name text DEFAULT 'default',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  email text NOT NULL,
  first_name text,
  last_name text,
  company text,
  title text,
  phone text,
  linkedin_url text,
  source text DEFAULT 'manual' CHECK (source IN ('scraped','manual','imported','enriched')),
  enrichment_data jsonb DEFAULT '{}',
  status text DEFAULT 'new' CHECK (status IN ('new','contacted','replied','qualified','converted','lost')),
  tags text[] DEFAULT '{}',
  custom_fields jsonb DEFAULT '{}',
  score integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  domain text,
  industry text,
  size_range text,
  location text,
  website text,
  description text,
  linkedin_url text,
  tags text[] DEFAULT '{}',
  custom_fields jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT companies_tenant_domain_unique UNIQUE (tenant_id, domain)
);

-- Partial unique: only enforce when domain IS NOT NULL
-- The table-level UNIQUE above covers (tenant_id, domain) including NULLs,
-- but Postgres treats NULLs as distinct in UNIQUE constraints, so this is safe.
-- If stricter NULL exclusion is needed, use a partial unique index instead:
DROP INDEX IF EXISTS companies_tenant_id_domain_key;
CREATE UNIQUE INDEX companies_tenant_domain_unique_idx ON companies (tenant_id, domain) WHERE domain IS NOT NULL;

CREATE TABLE contact_companies (
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, company_id)
);

CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  list_type text DEFAULT 'static' CHECK (list_type IN ('static','dynamic')),
  filter_rules jsonb DEFAULT '{"conditions":[]}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE list_contacts (
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);

CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  category text DEFAULT 'cold_outreach' CHECK (category IN ('cold_outreach','follow_up','intro','breakup','referral')),
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  delay_days integer DEFAULT 0,
  step_type text DEFAULT 'email' CHECK (step_type IN ('email','linkedin','task')),
  subject text,
  body_template text,
  channel text DEFAULT 'email',
  variant_key text DEFAULT 'A',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step_order integer DEFAULT 1,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','completed','replied')),
  next_step_at timestamptz,
  enrolled_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sequence_id, contact_id)
);

CREATE TABLE deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  deal_name text NOT NULL,
  value numeric(12,2) DEFAULT 0,
  stage text DEFAULT 'lead' CHECK (stage IN ('lead','qualified','proposal','negotiation','closed_won','closed_lost')),
  expected_close_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
    'email_sent','email_opened','email_replied',
    'note_added','status_changed','enriched',
    'sequence_enrolled','sequence_completed','sequence_step_sent',
    'deal_created','deal_stage_changed',
    'contact_created','company_created',
    'list_added','list_removed'
  )),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- contacts
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_tenant_email ON contacts(tenant_id, email);
CREATE INDEX idx_contacts_tenant_status ON contacts(tenant_id, status);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- companies
CREATE INDEX idx_companies_tenant ON companies(tenant_id);
CREATE INDEX idx_companies_tenant_domain ON companies(tenant_id, domain);

-- activities
CREATE INDEX idx_activities_tenant_contact ON activities(tenant_id, contact_id);
CREATE INDEX idx_activities_tenant_company ON activities(tenant_id, company_id);
CREATE INDEX idx_activities_tenant_type ON activities(tenant_id, activity_type);
CREATE INDEX idx_activities_created ON activities(created_at DESC);

-- sequence_enrollments
CREATE INDEX idx_enrollments_sequence_status ON sequence_enrollments(sequence_id, status);
CREATE INDEX idx_enrollments_next_step ON sequence_enrollments(next_step_at) WHERE status = 'active';

-- deals
CREATE INDEX idx_deals_tenant_stage ON deals(tenant_id, stage);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Helper: extract tenant_id from JWT app_metadata
-- API routes use service_role key with x-api-key auth, so RLS is bypassed there.
-- These policies protect against direct Supabase client access.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_isolation ON tenants
  USING (id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
-- api_keys: service_role only — no user-facing policy
CREATE POLICY api_keys_deny_all ON api_keys
  USING (false);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_isolation ON contacts
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_isolation ON companies
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

ALTER TABLE contact_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_companies_isolation ON contact_companies
  USING (
    EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.id = contact_companies.contact_id
        AND c.tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id')
    )
  );

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_isolation ON notes
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY lists_isolation ON lists
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

ALTER TABLE list_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY list_contacts_isolation ON list_contacts
  USING (
    EXISTS (
      SELECT 1 FROM lists l
      WHERE l.id = list_contacts.list_id
        AND l.tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id')
    )
  );

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_templates_isolation ON email_templates
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY sequences_isolation ON sequences
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY sequence_steps_isolation ON sequence_steps
  USING (
    EXISTS (
      SELECT 1 FROM sequences s
      WHERE s.id = sequence_steps.sequence_id
        AND s.tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id')
    )
  );

ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY sequence_enrollments_isolation ON sequence_enrollments
  USING (
    EXISTS (
      SELECT 1 FROM sequences s
      WHERE s.id = sequence_enrollments.sequence_id
        AND s.tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id')
    )
  );

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY deals_isolation ON deals
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY activities_isolation ON activities
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER lists_updated_at BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sequences_updated_at BEFORE UPDATE ON sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sequence_enrollments_updated_at BEFORE UPDATE ON sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
