const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://lcvcvlsmqkjovzwafdzz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjdmN2bHNtcWtqb3Z6d2FmZHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NTcxOTUsImV4cCI6MjEwMjMzMzE5NX0.z5_o6ZqXWx4s9VtFhLXVij_u0REta-6elSayPHdoYnA";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Signing in as Admin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@salut-pangkalpinang.ac.id",
    password: "SalutOwner#2026!Pgp",
  });

  if (authError) {
    console.error("Auth failed:", authError.message);
    process.exit(1);
  }

  console.log("Fetching fee types...");
  const { data: feeTypes, error: ftError } = await supabase.from("fee_types").select("*");
  if (ftError) {
    console.error("Failed to fetch fee types:", ftError.message);
    process.exit(1);
  }

  console.log("Found fee types:", feeTypes.map((f) => f.code));

  const salutServiceType = feeTypes.find((f) => f.code === "SALUT_SERVICE") || feeTypes[0];
  const admisionType = feeTypes.find((f) => f.code === "ADMISION") || feeTypes[0];
  const packageType = feeTypes.find((f) => f.code === "TUITION_PACKAGE") || feeTypes[0];
  const perSksType = feeTypes.find((f) => f.code === "COURSE_PER_SKS") || feeTypes[0];

  const ratesToInsert = [
    {
      fee_type_id: salutServiceType.id,
      study_program_id: null,
      service_scheme_id: null,
      calculation_type: "fixed",
      amount: 250000,
      is_active: true,
    },
    {
      fee_type_id: admisionType.id,
      study_program_id: null,
      service_scheme_id: null,
      calculation_type: "fixed",
      amount: 100000,
      is_active: true,
    },
    {
      fee_type_id: packageType.id,
      study_program_id: null,
      service_scheme_id: null,
      calculation_type: "fixed",
      amount: 1300000,
      is_active: true,
    },
    {
      fee_type_id: perSksType.id,
      study_program_id: null,
      service_scheme_id: null,
      calculation_type: "per_sks",
      amount: 35000,
      is_active: true,
    },
  ];

  console.log("Upserting fee rates...");
  const { data: inserted, error: insertError } = await supabase
    .from("fee_rates")
    .upsert(ratesToInsert, { onConflict: "fee_type_id, calculation_type" });

  if (insertError) {
    console.error("Insert error:", insertError.message);
    // If upsert fails, try direct insert
    const { error: insErr } = await supabase.from("fee_rates").insert(ratesToInsert);
    if (insErr) {
      console.error("Direct insert error:", insErr.message);
    } else {
      console.log("Successfully inserted default fee rates!");
    }
  } else {
    console.log("Successfully upserted default fee rates!");
  }
}

main();
