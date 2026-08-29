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

async function wipeAll() {
  console.log('Logging in as Owner...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authErr) {
    console.error('Auth failed:', authErr.message);
    return;
  }

  console.log('Auth SUCCESS! User ID:', authData.user?.id);

  // 1. Fetch all students
  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('id, full_name');
  
  if (studErr) {
    console.error('Error fetching students:', studErr.message);
    return;
  }

  console.log(`Found ${students?.length || 0} students to process.`);

  for (const s of students || []) {
    console.log(`Resetting transactions for student: ${s.full_name} (${s.id})`);
    const { data: resetRes, error: resetErr } = await supabase.rpc('reset_student_transactions', { p_student_id: s.id });
    if (resetErr) {
      console.error(`  Error resetting student transactions:`, resetErr.message);
    } else {
      console.log(`  Transactions reset result:`, resetRes);
    }

    console.log(`  Deleting status history for student ${s.id}...`);
    const { error: histErr } = await supabase.from('student_status_history').delete().eq('student_id', s.id);
    if (histErr) {
      console.error(`  Error deleting status history:`, histErr.message);
    }

    console.log(`  Deleting student row ${s.id}...`);
    const { error: delStudErr } = await supabase.from('students').delete().eq('id', s.id);
    if (delStudErr) {
      console.error(`  Error deleting student row:`, delStudErr.message);
    } else {
      console.log(`  Student ${s.full_name} DELETED SUCCESSFULLY!`);
    }
  }

  // 2. Also reset operational transactions and remittances
  console.log('\nResetting operational transactions...');
  const { error: opsErr } = await supabase.from('operational_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (opsErr) console.error('Ops del err:', opsErr.message);

  console.log('\nResetting operational void requests...');
  const { error: opsVoidErr } = await supabase.from('operational_transaction_void_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (opsVoidErr) console.error('Ops void del err:', opsVoidErr.message);

  // 3. Re-check final students count
  const { count: finalStudentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
  console.log(`\n=== FINAL STUDENT COUNT: ${finalStudentCount} rows ===`);
}

wipeAll();
