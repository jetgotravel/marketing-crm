import supabase from './db.js';
import { escapeIlike } from './validate.js';

const OPERATORS = {
  equals: (query, field, value) => query.eq(field, value),
  not_equals: (query, field, value) => query.neq(field, value),
  contains: (query, field, value) => query.ilike(field, `%${escapeIlike(String(value))}%`),
  not_contains: (query, field, value) => query.not(field, 'ilike', `%${escapeIlike(String(value))}%`),
  starts_with: (query, field, value) => query.ilike(field, `${escapeIlike(String(value))}%`),
  ends_with: (query, field, value) => query.ilike(field, `%${escapeIlike(String(value))}`),
  gt: (query, field, value) => query.gt(field, value),
  lt: (query, field, value) => query.lt(field, value),
  is_empty: (query, field) => query.is(field, null),
  is_not_empty: (query, field) => query.not(field, 'is', null),
};

const ALLOWED_FIELDS = [
  'email', 'first_name', 'last_name', 'company', 'title',
  'status', 'source', 'score',
];

function resolveField(field) {
  if (ALLOWED_FIELDS.includes(field)) return { column: field, type: 'direct' };
  if (field === 'tags') return { column: 'tags', type: 'tags' };
  if (field.startsWith('custom_fields.')) return { column: field, type: 'jsonb' };
  return null;
}

export async function evaluateFilterRules(tenantId, filterRules, { page = 1, limit = 20, countOnly = false } = {}) {
  const conditions = filterRules?.conditions || [];

  let query = supabase
    .from('contacts')
    .select(countOnly ? 'id' : '*', { count: 'exact' })
    .eq('tenant_id', tenantId);

  for (const condition of conditions) {
    const { field, operator, value } = condition;

    if (!operator || !OPERATORS[operator]) continue;

    const resolved = resolveField(field);
    if (!resolved) continue;

    if (resolved.type === 'tags') {
      if (operator === 'contains') {
        query = query.contains('tags', [value]);
      } else if (operator === 'not_contains') {
        query = query.not('tags', 'cs', `{${value}}`);
      } else if (operator === 'is_empty') {
        query = query.eq('tags', '{}');
      } else if (operator === 'is_not_empty') {
        query = query.neq('tags', '{}');
      }
      continue;
    }

    if (resolved.type === 'jsonb') {
      const path = resolved.column.replace('custom_fields.', '');
      if (operator === 'equals') {
        query = query.eq(`custom_fields->>${path}`, value);
      } else if (operator === 'not_equals') {
        query = query.neq(`custom_fields->>${path}`, value);
      } else if (operator === 'contains') {
        query = query.ilike(`custom_fields->>${path}`, `%${escapeIlike(String(value))}%`);
      } else if (operator === 'is_empty') {
        query = query.is(`custom_fields->>${path}`, null);
      } else if (operator === 'is_not_empty') {
        query = query.not(`custom_fields->>${path}`, 'is', null);
      }
      continue;
    }

    query = OPERATORS[operator](query, resolved.column, value);
  }

  if (!countOnly) {
    const offset = (page - 1) * limit;
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;
  if (error) return { error };

  return { data: countOnly ? [] : data, count };
}
