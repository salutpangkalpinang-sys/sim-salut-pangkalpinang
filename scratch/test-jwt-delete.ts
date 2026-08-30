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
  console.log("=== TESTING DELETE WITH EXPLICIT JWT AUTH HEADER ===");

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authError || !authData.session) {
    console.error("Auth error:", authError);
    process.exit(1);
  }

  const token = authData.session.access_token;
  console.log("Authenticated! Token acquired:", token.substring(0, 30) + "...");

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Check role RPC
  const { data: userRole } = await supabase.rpc("get_current_user_role");
  console.log("User role from JWT client:", userRole);

  // Test delete student_payments
  const { data: pmts } = await supabase.from("student_payments").select("id");
  console.log(`Found ${pmts?.length || 0} student payments.`);

  if (pmts && pmts.length > 0) {
    const ids = pmts.map((p) => p.id);
    const { error: delErr, count: delCount } = await supabase
      .from("student_payments")
      .delete({ count: "exact" })
      .in("id", ids);

    console.log("Delete student_payments with JWT client result:", { delErr, delCount });
  }
}

main().catch(console.error);
