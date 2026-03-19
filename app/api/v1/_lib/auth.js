import supabase from './db.js';

export async function authenticate(req) {
  const key = req.headers.get('x-api-key');
  if (!key) return { error: 'Missing x-api-key', status: 401 };

  const { data, error } = await supabase
    .from('api_keys')
    .select('tenant_id')
    .eq('key', key)
    .single();

  if (error || !data) return { error: 'Invalid API key', status: 401 };

  return { tenant_id: data.tenant_id };
}
