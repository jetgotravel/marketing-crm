-- Add missing indexes for tenant-scoped queries and FK lookups

-- notes: queried by tenant_id and contact_id
CREATE INDEX IF NOT EXISTS idx_notes_tenant ON notes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notes_contact ON notes (contact_id);

-- email_templates: queried by tenant_id
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates (tenant_id);

-- sequences: queried by tenant_id
CREATE INDEX IF NOT EXISTS idx_sequences_tenant ON sequences (tenant_id);

-- list_contacts: queried by list_id (PK is composite but list_id lookups need standalone index)
CREATE INDEX IF NOT EXISTS idx_list_contacts_list ON list_contacts (list_id);

-- sequence_steps: queried by sequence_id for step ordering
CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence ON sequence_steps (sequence_id);

-- contact_companies: queried by company_id for reverse lookups
CREATE INDEX IF NOT EXISTS idx_contact_companies_company ON contact_companies (company_id);
