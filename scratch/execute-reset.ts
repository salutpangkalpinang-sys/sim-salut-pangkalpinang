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
  console.log("=== EXECUTING SYSTEM RESET WITH NOT NULL FILTER ===");

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

  console.log("Authenticated as Owner:", authData.user.email);

  const tables = [
    "ut_remittance_items",
    "ut_remittance_void_requests",
    "ut_remittances",
    "payment_allocations",
    "payment_void_requests",
    "student_payments",
    "invoice_items",
    "invoices",
    "lip_documents",
    "registration_fee_snapshots",
    "registrations",
    "operational_transaction_void_requests",
    "operational_transactions",
    "student_status_history",
    "students",
  ];

  for (const table of tables) {
    console.log(`Clearing table '${table}' via not('id', 'is', null)...`);
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .not("id", "is", null);

    if (error) {
      console.warn(`Table '${table}' delete result:`, error.message);
    } else {
      console.log(`✓ Cleared ${count ?? 0} rows from '${table}'.`);
    }
  }

  console.log("\n=== FINAL RECONCILIATION CHECK ===");
  let grandTotal = 0;
  for (const table of tables) {
    const { count } = await supabase.from(table).select("id", { count: "exact" });
    const c = count ?? 0;
    grandTotal += c;
    console.log(`- Table '${table}': ${c} rows remaining`);
  }

  if (grandTotal === 0) {
    console.log("\n🎉 SUCCESS! ALL ENTRY DATA HAS BEEN CLEARED!");
  } else {
    console.warn(`\n⚠️ Remaining rows: ${grandTotal}`);
  }
}

main().catch(console.error);
