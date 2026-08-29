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

async function fixAhmad() {
  console.log('Logging in as Owner to update create_internal_user function...');
  await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });

  // Let's test calling create_internal_user RPC now with updated logic
  const { data: userId, error: rpcErr } = await supabase.rpc('create_internal_user', {
    p_email: 'ahmad@salut-pangkalpinang.ac.id',
    p_password: 'suksesya',
    p_full_name: 'Ahmad Kasir',
    p_role_code: 'finance_admin',
  });

  if (rpcErr) {
    console.error('RPC Error:', rpcErr);
  } else {
    console.log('RPC Returned User ID:', userId);
  }

  // Now test sign in
  console.log('\nTesting login for ahmad with password: suksesya...');
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesya',
  });

  if (loginErr) {
    console.error('Login Failed:', loginErr.message);
  } else {
    console.log('LOGIN SUCCESSFUL!');
    console.log('User ID:', loginData.user?.id);
    console.log('Email:', loginData.user?.email);
  }
}

fixAhmad();
