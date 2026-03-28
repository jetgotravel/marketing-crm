-- Import batch tracking
-- ============================================================

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text,
  source text DEFAULT 'api',
  contact_count integer DEFAULT 0,
  company_count integer DEFAULT 0,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_import_batches_tenant ON import_batches(tenant_id);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_batches_isolation ON import_batches
  USING (tenant_id::text = (auth.jwt()->'app_metadata'->>'tenant_id'));

-- Add batch reference to contacts and companies
ALTER TABLE contacts ADD COLUMN import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN import_batch_id uuid REFERENCES import_batches(id) ON DELETE SET NULL;

CREATE INDEX idx_contacts_batch ON contacts(import_batch_id);
CREATE INDEX idx_companies_batch ON companies(import_batch_id);
