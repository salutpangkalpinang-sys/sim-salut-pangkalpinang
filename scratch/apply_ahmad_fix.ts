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

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFix() {
  console.log('Testing create_internal_user RPC for ahmad with full GoTrue payload...');
  await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });

  const { data: userId, error: rpcErr } = await supabase.rpc('create_internal_user', {
    p_email: 'ahmad@salut-pangkalpinang.ac.id',
    p_password: 'suksesya',
    p_full_name: 'Ahmad Kasir',
    p_role_code: 'finance_admin',
  });

  if (rpcErr) console.error('RPC Error:', rpcErr);
  else console.log('RPC Returned:', userId);

  console.log('\nTesting login for ahmad@salut-pangkalpinang.ac.id with password: suksesya...');
  const res = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesya',
  });

  if (res.error) console.error('LOGIN ERROR:', res.error.message);
  else console.log('LOGIN SUCCESSFUL! User ID:', res.data.user.id);
}

testFix();
