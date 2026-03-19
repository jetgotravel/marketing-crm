/**
 * Render a template string with contact/custom data.
 * Supports: {{first_name}}, {{last_name}}, {{company}}, {{title}}, {{email}}, {{custom.field_name}}
 */
export function renderTemplate(template, contact) {
  if (!template) return '';

  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key) => {
    if (key.startsWith('custom.')) {
      const field = key.slice(7);
      return contact.custom_fields?.[field] ?? '';
    }
    return contact[key] ?? '';
  });
}
