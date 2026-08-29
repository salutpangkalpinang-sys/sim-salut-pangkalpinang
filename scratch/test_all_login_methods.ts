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

async function testAll() {
  console.log('--- TESTING LOGIN METHODS ---');

  // Let's test admin login first
  console.log('1. Testing Owner login...');
  const ownerRes = await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });
  if (ownerRes.error) {
    console.error('Owner Login Failed:', ownerRes.error);
    return;
  }
  console.log('Owner Login SUCCESS! User ID:', ownerRes.data.user.id);

  // Now let's test Ahmad login
  console.log('\n2. Testing Ahmad login with ahmad@salut-pangkalpinang.ac.id / suksesya...');
  const ahmadRes = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesya',
  });

  if (ahmadRes.error) {
    console.error('Ahmad Login Failed Error:', ahmadRes.error);
  } else {
    console.log('Ahmad Login SUCCESS! User ID:', ahmadRes.data.user.id);
  }
}

testAll();
