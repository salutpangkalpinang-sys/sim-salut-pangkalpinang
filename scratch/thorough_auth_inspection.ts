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

async function inspectAll() {
  console.log('=== THOROUGH AUTH INSPECTION ===\n');

  console.log('1. Testing Owner Login (admin@salut-pangkalpinang.ac.id / suksesterus)...');
  const resOwner = await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });

  if (resOwner.error) {
    console.error('   Owner Login ERROR:', resOwner.error);
  } else {
    console.log('   Owner Login SUCCESS! User ID:', resOwner.data.user.id);
    console.log('   Owner Metadata:', JSON.stringify(resOwner.data.user.user_metadata, null, 2));
    console.log('   Owner App Metadata:', JSON.stringify(resOwner.data.user.app_metadata, null, 2));
  }

  console.log('\n2. Testing Ahmad Login (ahmad@salut-pangkalpinang.ac.id / suksesya)...');
  const resAhmad1 = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesya',
  });

  if (resAhmad1.error) {
    console.error('   Ahmad (suksesya) Login ERROR:', resAhmad1.error);
  } else {
    console.log('   Ahmad (suksesya) Login SUCCESS! User ID:', resAhmad1.data.user.id);
  }

  console.log('\n3. Testing Ahmad Login (ahmad@salut-pangkalpinang.ac.id / suksesterus)...');
  const resAhmad2 = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });

  if (resAhmad2.error) {
    console.error('   Ahmad (suksesterus) Login ERROR:', resAhmad2.error);
  } else {
    console.log('   Ahmad (suksesterus) Login SUCCESS! User ID:', resAhmad2.data.user.id);
  }
}

inspectAll();
