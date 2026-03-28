-- Phase 4: A/B Testing + Intelligence
-- ============================================================

-- Split ratio on steps for A/B testing
ALTER TABLE sequence_steps
  ADD COLUMN split_ratio integer DEFAULT 50 CHECK (split_ratio >= 0 AND split_ratio <= 100);

-- Track which variant was assigned to each enrollment per step
ALTER TABLE sequence_enrollments
  ADD COLUMN assigned_variant text DEFAULT 'A';
