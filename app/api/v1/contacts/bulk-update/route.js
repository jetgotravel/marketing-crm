import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, badRequest, dbError } from '../../_lib/errors.js';
import { clampString, isValidEmail, isValidNumber, isValidEnum, validateArray, ENUMS } from '../../_lib/validate.js';

const ALLOWED_FIELDS = [
  'email', 'first_name', 'last_name', 'company', 'title',
  'phone', 'linkedin_url', 'source', 'status', 'tags',
  'custom_fields', 'score', 'company_id', 'is_placeholder',
  'seniority', 'department', 'city', 'country', 'photo_url',
  'employment_history',
];

const STRING_LIMITS = {
  first_name: 255, last_name: 255, company: 255, title: 255,
  phone: 50, linkedin_url: 500, seniority: 100, department: 100,
  city: 255, country: 100, photo_url: 500,
};

export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { updates } = body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return badRequest('updates must be a non-empty array of {id, ...fields}');
  }
  if (updates.length > 500) {
    return badRequest('Maximum 500 contacts per bulk update');
  }

  let updated = 0;
  let errors = [];

  for (const item of updates) {
    if (!item.id) {
      errors.push({ error: 'Missing id' });
      continue;
    }

    const fields = {};
    for (const key of ALLOWED_FIELDS) {
      if (item[key] !== undefined) {
        let val = item[key];
        if (key === 'email' && val) val = val.toLowerCase().trim();
        else if (STRING_LIMITS[key] && val) val = clampString(val, STRING_LIMITS[key]);
        fields[key] = val;
      }
    }

    if (Object.keys(fields).length === 0) {
      errors.push({ id: item.id, error: 'No valid fields' });
      continue;
    }

    const { error } = await supabase
      .from('contacts')
      .update(fields)
      .eq('id', item.id)
      .eq('tenant_id', auth.tenant_id);

    if (error) {
      errors.push({ id: item.id, error: error.message });
    } else {
      updated++;
    }
  }

  return NextResponse.json({
    data: {
      updated,
      failed: errors.length,
      total_submitted: updates.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
}
