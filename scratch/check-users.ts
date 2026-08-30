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
  console.log("=== CHECKING USER ACCOUNTS & ROLES ===");

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (authErr || !authData.session) {
    console.error("Auth error:", authErr);
    process.exit(1);
  }

  const token = authData.session.access_token;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: profiles } = await supabase.from("profiles").select("id, full_name, is_active");
  const { data: userRoles } = await supabase.from("user_roles").select("user_id, roles(code, name)");

  console.log("Profiles:", JSON.stringify(profiles, null, 2));
  console.log("User Roles:", JSON.stringify(userRoles, null, 2));
}

main().catch(console.error);
