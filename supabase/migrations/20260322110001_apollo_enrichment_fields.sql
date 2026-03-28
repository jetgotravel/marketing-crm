-- Standard enrichment fields from Apollo
-- These are common enough to warrant dedicated columns

ALTER TABLE contacts
  ADD COLUMN seniority text,
  ADD COLUMN department text,
  ADD COLUMN city text,
  ADD COLUMN country text,
  ADD COLUMN photo_url text,
  ADD COLUMN employment_history jsonb DEFAULT '[]';
