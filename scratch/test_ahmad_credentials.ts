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

async function testCredentials() {
  console.log('--- TESTING AHMAD LOGINS ---');

  // Test 1: email = ahmad@salut-pangkalpinang.ac.id, password = suksesya
  console.log('\n1. Testing email: ahmad@salut-pangkalpinang.ac.id, password: suksesya');
  const res1 = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesya',
  });
  if (res1.error) console.log('   Result 1 ERROR:', res1.error.message);
  else console.log('   Result 1 SUCCESS! User ID:', res1.data.user.id);

  // Test 2: email = ahmad@salut-pangkalpinang.ac.id, password = suksesterus
  console.log('\n2. Testing email: ahmad@salut-pangkalpinang.ac.id, password: suksesterus');
  const res2 = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });
  if (res2.error) console.log('   Result 2 ERROR:', res2.error.message);
  else console.log('   Result 2 SUCCESS! User ID:', res2.data.user.id);

  // Test 3: email = admin@salut-pangkalpinang.ac.id, password = suksesterus
  console.log('\n3. Testing email: admin@salut-pangkalpinang.ac.id, password: suksesterus');
  const res3 = await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });
  if (res3.error) console.log('   Result 3 ERROR:', res3.error.message);
  else console.log('   Result 3 SUCCESS! User ID:', res3.data.user.id);
}

testCredentials();
