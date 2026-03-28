-- Safeguard: enrollments start as pending_review, not active
-- ============================================================

-- Add pending_review to enrollment status options
ALTER TABLE sequence_enrollments DROP CONSTRAINT IF EXISTS sequence_enrollments_status_check;
ALTER TABLE sequence_enrollments ADD CONSTRAINT sequence_enrollments_status_check
  CHECK (status IN ('pending_review','active','paused','completed','replied'));
