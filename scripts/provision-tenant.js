#!/usr/bin/env node

/**
 * Provision a new tenant + API key.
 * Usage: node scripts/provision-tenant.js "Tenant Name"
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const tenantName = process.argv[2];
if (!tenantName) {
  console.error('Usage: node scripts/provision-tenant.js "Tenant Name"');
  process.exit(1);
}

// Parse .env.local
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  env[key.trim()] = rest.join('=').trim();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function provision() {
  // 1. Create tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({ name: tenantName })
    .select()
    .single();

  if (tenantErr) {
    console.error('Failed to create tenant:', tenantErr.message);
    process.exit(1);
  }
  console.log('Tenant created:', tenant.id);

  // 2. Create API key
  const { data: apiKey, error: keyErr } = await supabase
    .from('api_keys')
    .insert({ tenant_id: tenant.id, name: 'default' })
    .select()
    .single();

  if (keyErr) {
    console.error('Failed to create API key:', keyErr.message);
    process.exit(1);
  }
  console.log('API key created:', apiKey.key);

  // 3. Output integration details
  console.log('\n--- Tenant provisioned ---');
  console.log(`Tenant:     ${tenantName}`);
  console.log(`Tenant ID:  ${tenant.id}`);
  console.log(`API Key:    ${apiKey.key}`);
  console.log(`\nAdd to client .env:`);
  console.log(`  CRM_API_KEY=${apiKey.key}`);
  console.log(`  CRM_API_URL=${supabaseUrl.replace('.supabase.co', '').includes('http') ? 'https://your-crm-domain.com' : supabaseUrl}`);
  console.log(`\nUse this header for API requests:`);
  console.log(`  x-api-key: ${apiKey.key}`);
}

provision();
