import supabase from './db.js';

export async function logActivity(tenantId, { contactId, companyId, dealId, type, metadata = {} }) {
  const { error } = await supabase.from('activities').insert({
    tenant_id: tenantId,
    contact_id: contactId || null,
    company_id: companyId || null,
    deal_id: dealId || null,
    activity_type: type,
    metadata,
  });

  if (error) console.error('Failed to log activity:', error.message);
}
