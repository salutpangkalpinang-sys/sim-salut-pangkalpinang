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

async function testPostgresOwner() {
  console.log('Testing create_internal_user with OWNER TO postgres...');

  // First let's check auth.users table for ahmad
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'admin@salut-pangkalpinang.ac.id',
    password: 'suksesterus',
  });

  console.log('Auth user ID:', authData.user?.id);
}

testPostgresOwner();
