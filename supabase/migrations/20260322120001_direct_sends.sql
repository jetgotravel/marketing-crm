-- Direct email sends (non-sequence)
-- ============================================================

-- Add type and custom content fields to send_queue
ALTER TABLE send_queue
  ADD COLUMN send_type text DEFAULT 'sequence' CHECK (send_type IN ('sequence', 'direct')),
  ADD COLUMN custom_subject text,
  ADD COLUMN custom_body text;

-- Make step_id and enrollment_id nullable for direct sends
ALTER TABLE send_queue ALTER COLUMN enrollment_id DROP NOT NULL;
ALTER TABLE send_queue ALTER COLUMN step_id DROP NOT NULL;

CREATE INDEX idx_send_queue_type ON send_queue(send_type, status);
