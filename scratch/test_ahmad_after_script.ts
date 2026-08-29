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

async function testLogin() {
  console.log('Testing login for ahmad@salut-pangkalpinang.ac.id with password: suksesya...');
  const res = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesya',
  });

  if (res.error) {
    console.error('Login Failed Error:', res.error.message);
    console.error('Error Status:', (res.error as any).status);
  } else {
    console.log('LOGIN SUCCESSFUL!');
    console.log('User ID:', res.data.user.id);
  }
}

testLogin();
