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

async function testRpcDelete() {
  console.log('Testing RPC delete_student_by_name with pattern "" ...');
  const { data, error } = await supabase.rpc('delete_student_by_name', { p_name_pattern: '' });
  
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Result:', JSON.stringify(data, null, 2));
  }
}

testRpcDelete();
