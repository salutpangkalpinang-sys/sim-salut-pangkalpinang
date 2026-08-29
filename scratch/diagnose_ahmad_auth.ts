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

async function diagnose() {
  console.log('--- DIAGNOSING AHMAD AUTH ---');
  
  // 1. Try sign in with ahmad@salut-pangkalpinang.ac.id and suksesya
  const res1 = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesya'
  });
  console.log('Result for suksesya:', res1.error ? res1.error.message : 'SUCCESS');

  // 2. Try sign in with ahmad@salut-pangkalpinang.ac.id and suksesterus
  const res2 = await supabase.auth.signInWithPassword({
    email: 'ahmad@salut-pangkalpinang.ac.id',
    password: 'suksesterus'
  });
  console.log('Result for suksesterus:', res2.error ? res2.error.message : 'SUCCESS');
}

diagnose();
