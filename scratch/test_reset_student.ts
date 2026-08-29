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

async function checkResetStudentTx() {
  console.log('Testing RPC reset_student_transactions...');
  const dummyId = '00000000-0000-0000-0000-000000000000';
  const { data, error } = await supabase.rpc('reset_student_transactions', { p_student_id: dummyId });
  
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Result:', JSON.stringify(data, null, 2));
  }
}

checkResetStudentTx();
