import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars: Record<string, string> = {};

envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      envVars[key] = val;
    }
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmail = envVars.DEV_ADMIN_EMAIL || "admin@salut-pangkalpinang.ac.id";
const adminPassword = "suksesterus";

async function main() {
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData } = await authClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  const token = authData.session!.access_token;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  console.log("=== TESTING UNLINKING REGISTRATIONS ===");

  const { data: regs } = await supabase.from("registrations").select("id, student_id");
  console.log("Current registrations:", regs);

  const { data: stds } = await supabase.from("students").select("id, full_name");
  console.log("Current students:", stds);

  // Try updating registration student_id to null or dummy
  if (regs && regs.length > 0) {
    const { error: updErr } = await supabase
      .from("registrations")
      .update({ student_id: null })
      .in("id", regs.map(r => r.id));

    console.log("Update registrations student_id to null result:", updErr);
  }

  // Now try deleting students
  if (stds && stds.length > 0) {
    await supabase.from("student_status_history").delete().in("student_id", stds.map(s => s.id));
    const { error: delStdErr, count: delStdCount } = await supabase
      .from("students")
      .delete({ count: "exact" })
      .in("id", stds.map(s => s.id));

    console.log("Delete students result:", { delStdErr, delStdCount });
  }
}

main().catch(console.error);
