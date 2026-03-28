/**
 * Escape HTML special characters to prevent XSS when contact data
 * is interpolated into email templates.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a template string with contact/custom data.
 * Supports:
 *   {{first_name}} — simple interpolation
 *   {{first_name|default:"there"}} — with fallback if empty/missing
 *   {{custom.field_name}} — custom fields
 * All interpolated values are HTML-escaped to prevent injection.
 */
export function renderTemplate(template, contact) {
  if (!template) return '';

  return template.replace(/\{\{(\w+(?:\.\w+)?)(?:\|default:"([^"]*)")?\}\}/g, (match, key, defaultValue) => {
    let value;
    if (key.startsWith('custom.')) {
      const field = key.slice(7);
      value = contact.custom_fields?.[field];
    } else {
      value = contact[key];
    }

    // Use default if value is null, undefined, or empty string
    if (value === null || value === undefined || value === '') {
      value = defaultValue ?? '';
    }

    return escapeHtml(value);
  });
}
