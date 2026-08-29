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

async function verifyRpc() {
  console.log('Logging in as Owner...');
  await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });

  console.log('Calling create_internal_user RPC for Ahmad Kasir...');
  const { data: userId, error: rpcErr } = await supabase.rpc('create_internal_user', {
    p_email: 'ahmad@salut-pangkalpinang.ac.id',
    p_password: 'suksesterus',
    p_full_name: 'Ahmad Kasir',
    p_role_code: 'finance_admin',
  });

  if (rpcErr) {
    console.error('RPC ERROR:', rpcErr);
  } else {
    console.log('RPC SUCCESS! Returned User ID:', userId);
  }

  console.log('\nQuerying all profiles from Supabase DB...');
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*, user_roles(*, roles(*))');

  if (profErr) {
    console.error('Profiles fetch error:', profErr);
  } else {
    console.log(`TOTAL USERS IN DB: ${profiles?.length}`);
    console.log(JSON.stringify(profiles, null, 2));
  }
}

verifyRpc();
