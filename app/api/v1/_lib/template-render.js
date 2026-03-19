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
 * Supports: {{first_name}}, {{last_name}}, {{company}}, {{title}}, {{email}}, {{custom.field_name}}
 * All interpolated values are HTML-escaped to prevent injection.
 */
export function renderTemplate(template, contact) {
  if (!template) return '';

  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key) => {
    if (key.startsWith('custom.')) {
      const field = key.slice(7);
      return escapeHtml(contact.custom_fields?.[field] ?? '');
    }
    return escapeHtml(contact[key] ?? '');
  });
}
