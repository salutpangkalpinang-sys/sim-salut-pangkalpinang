import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const email = envVars['DEV_ADMIN_EMAIL'];
const password = envVars['DEV_ADMIN_PASSWORD'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWithAuth() {
  console.log('Signing in with DEV_ADMIN credentials...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authErr) {
    console.error('Auth failed:', authErr.message);
    return;
  }

  console.log('Auth successful for user:', authData.user?.email);

  const tables = [
    'students',
    'student_status_history',
    'registrations',
    'registration_fee_snapshots',
    'lip_documents',
    'invoices',
    'invoice_items',
    'student_payments',
    'payment_allocations',
    'payment_void_requests',
    'ut_remittances',
    'ut_remittance_items',
    'ut_remittance_void_requests',
    'operational_transactions',
    'operational_transaction_void_requests'
  ];

  console.log('\n=== REAL ROW COUNTS WITH AUTHENTICATED ADMIN ===');
  for (const table of tables) {
    const { count, error, data } = await supabase
      .from(table)
      .select('*', { count: 'exact' });
    
    if (error) {
      console.log(`${table}: Error (${error.message})`);
    } else {
      console.log(`${table}: ${count} rows`);
      if (count && count > 0) {
        console.log(`  Data in ${table}:`, JSON.stringify(data, null, 2));
      }
    }
  }
}

checkWithAuth();
