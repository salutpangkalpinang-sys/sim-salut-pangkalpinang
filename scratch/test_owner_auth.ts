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
const email = 'admin@salut-pangkalpinang.ac.id';
const password = 'suksesterus';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOwnerAuth() {
  console.log('Logging in as Owner with email:', email);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authErr) {
    console.error('Auth failed:', authErr.message);
    return;
  }

  console.log('Auth SUCCESS! Logged in User ID:', authData.user?.id);

  // Now fetch students with authenticated owner session!
  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('id, full_name, nim, nik, entry_year');
  
  if (studErr) {
    console.error('Error fetching students:', studErr.message);
  } else {
    console.log(`FOUND ${students?.length || 0} STUDENTS:`);
    console.log(JSON.stringify(students, null, 2));
  }
}

checkOwnerAuth();
