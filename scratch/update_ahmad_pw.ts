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

async function updateAhmadPassword() {
  console.log('Updating password for ahmad@salut-pangkalpinang.ac.id to suksesya...');
  await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });

  const { data, error } = await supabase.rpc('create_internal_user', {
    p_email: 'ahmad@salut-pangkalpinang.ac.id',
    p_password: 'suksesya',
    p_full_name: 'Ahmad Kasir',
    p_role_code: 'finance_admin',
  });

  if (error) {
    console.error('Update error:', error);
  } else {
    console.log('Password updated SUCCESS for Ahmad Kasir! User ID:', data);
  }
}

updateAhmadPassword();
