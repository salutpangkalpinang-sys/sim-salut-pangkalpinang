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

async function inspectOwner() {
  console.log('Logging in as Owner...');
  await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });

  const { data, error } = await supabase.rpc('get_user_auth_debug', { p_email: 'admin@salut-pangkalpinang.ac.id' });
  if (error) {
    console.error('RPC Error:', error.message);
  } else {
    console.log('OWNER AUTH DEBUG DATA:\n', JSON.stringify(data, null, 2));
  }

  const { data: dataAhmad, error: errAhmad } = await supabase.rpc('get_user_auth_debug', { p_email: 'ahmad@salut-pangkalpinang.ac.id' });
  if (errAhmad) {
    console.error('RPC Error Ahmad:', errAhmad.message);
  } else {
    console.log('\nAHMAD AUTH DEBUG DATA:\n', JSON.stringify(dataAhmad, null, 2));
  }
}

inspectOwner();
