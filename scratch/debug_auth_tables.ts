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

async function testDebug() {
  await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });

  const { data, error } = await supabase.rpc('get_user_auth_debug', { p_email: 'ahmad@salut-pangkalpinang.ac.id' });
  if (error) {
    console.log('RPC get_user_auth_debug error:', error.message);
  } else {
    console.log('DEBUG DATA FOR AHMAD:', JSON.stringify(data, null, 2));
  }

  const { data: dataOwner, error: errOwner } = await supabase.rpc('get_user_auth_debug', { p_email: 'admin@salut-pangkalpinang.ac.id' });
  if (errOwner) {
    console.log('RPC get_user_auth_debug owner error:', errOwner.message);
  } else {
    console.log('DEBUG DATA FOR OWNER:', JSON.stringify(dataOwner, null, 2));
  }
}

testDebug();
