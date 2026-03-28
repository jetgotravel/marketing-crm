const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email);
}

export function isValidUUID(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

export function clampString(value, maxLen = 255) {
  if (typeof value !== 'string') return value;
  return value.slice(0, maxLen);
}

export function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isValidDate(value) {
  if (!value) return true; // null/undefined OK
  const d = new Date(value);
  return !isNaN(d.getTime());
}

export function isValidEnum(value, allowed) {
  return allowed.includes(value);
}

/** Escape % and _ in user input before passing to ilike */
export function escapeIlike(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

/** Validate and bound an array, returns null if invalid */
export function validateArray(arr, maxLen = 500) {
  if (!Array.isArray(arr)) return null;
  return arr.slice(0, maxLen);
}

const CONTACT_SOURCES = ['scraped', 'manual', 'imported', 'enriched'];
const CONTACT_STATUSES = ['new', 'contacted', 'replied', 'qualified', 'converted', 'lost', 'bounced'];
const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const TEMPLATE_CATEGORIES = ['cold_outreach', 'follow_up', 'intro', 'breakup', 'referral'];

export const ENUMS = { CONTACT_SOURCES, CONTACT_STATUSES, DEAL_STAGES, TEMPLATE_CATEGORIES };
