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

async function testAhmadLogin() {
  console.log('Attempting login as ahmad@salut-pangkalpinang.ac.id with password suksesya...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesya',
  });

  if (error) {
    console.error('Login error:', error.message);
  } else {
    console.log('LOGIN SUCCESSFUL!');
    console.log('User ID:', data.user?.id);
    console.log('Email:', data.user?.email);
  }
}

testAhmadLogin();
