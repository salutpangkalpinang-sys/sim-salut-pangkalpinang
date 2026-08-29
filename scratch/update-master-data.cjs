const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://lcvcvlsmqkjovzwafdzz.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjdmN2bHNtcWtqb3Z6d2FmZHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NTcxOTUsImV4cCI6MjEwMjMzMzE5NX0.z5_o6ZqXWx4s9VtFhLXVij_u0REta-6elSayPHdoYnA";
const email = "admin@salut-pangkalpinang.ac.id";
const password = "suksesterus";

console.log("Connecting to Supabase URL:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Signing in as Owner...");
  const res = await supabase.auth.signInWithPassword({ email, password });
  if (res.error || !res.data.user) {
    console.error("Auth failed:", res.error?.message);
    process.exit(1);
  }

  console.log("Auth SUCCESS! User ID:", res.data.user.id);

  const { data: faculties } = await supabase.from("faculties").select("id, code");
  const { data: levels } = await supabase.from("study_levels").select("id, code");

  const facMap = Object.fromEntries((faculties || []).map((f) => [f.code, f.id]));
  const levMap = Object.fromEntries((levels || []).map((l) => [l.code, l.id]));

  console.log("Faculties map:", facMap);
  console.log("Levels map:", levMap);

  const feId = facMap["FE"] || facMap["FEB"] || faculties[0].id;
  const fstId = facMap["FST"] || faculties[0].id;
  const fhisipId = facMap["FHISIP"] || faculties[0].id;
  const fkipId = facMap["FKIP"] || faculties[0].id;

  const s1Id = levMap["S1"] || levels[0].id;
  const d4Id = levMap["D4"] || levels[0].id;
  const d3Id = levMap["D3"] || levels[0].id;

  const studyProgramsToUpsert = [
    // FST - S1
    { code: "252", name: "Sistem Informasi", faculty_id: fstId, study_level_id: s1Id },
    { code: "253", name: "Matematika", faculty_id: fstId, study_level_id: s1Id },
    { code: "254", name: "Statistika", faculty_id: fstId, study_level_id: s1Id },
    { code: "255", name: "Biologi", faculty_id: fstId, study_level_id: s1Id },
    { code: "256", name: "Agribisnis Bidang Minat Pertanian", faculty_id: fstId, study_level_id: s1Id },
    { code: "257", name: "Agribisnis Bidang Minat Peternakan", faculty_id: fstId, study_level_id: s1Id },
    { code: "258", name: "Agribisnis Bidang Minat Perikanan", faculty_id: fstId, study_level_id: s1Id },
    { code: "259", name: "Teknologi Pangan", faculty_id: fstId, study_level_id: s1Id },
    { code: "260", name: "Perencanaan Wilayah & Kota", faculty_id: fstId, study_level_id: s1Id },
    { code: "261", name: "Sains Data", faculty_id: fstId, study_level_id: s1Id },

    // FHISIP - S1
    { code: "311", name: "Ilmu Hukum", faculty_id: fhisipId, study_level_id: s1Id },
    { code: "312", name: "Administrasi Negara / Publik", faculty_id: fhisipId, study_level_id: s1Id },
    { code: "313", name: "Administrasi Bisnis", faculty_id: fhisipId, study_level_id: s1Id },
    { code: "314", name: "Ilmu Pemerintahan", faculty_id: fhisipId, study_level_id: s1Id },
    { code: "315", name: "Ilmu Komunikasi", faculty_id: fhisipId, study_level_id: s1Id },
    { code: "316", name: "Ilmu Perpustakaan", faculty_id: fhisipId, study_level_id: s1Id },
    { code: "317", name: "Sosiologi", faculty_id: fhisipId, study_level_id: s1Id },
    { code: "318", name: "Sastra Inggris Penerjemah", faculty_id: fhisipId, study_level_id: s1Id },
    { code: "319", name: "Perpajakan (S1)", faculty_id: fhisipId, study_level_id: s1Id },

    // FKIP - S1
    { code: "118", name: "Pendidikan Guru Sekolah Dasar (PGSD)", faculty_id: fkipId, study_level_id: s1Id },
    { code: "119", name: "Pendidikan Guru Anak Usia Dini (PGPAUD)", faculty_id: fkipId, study_level_id: s1Id },
    { code: "120", name: "Pendidikan Agama Islam", faculty_id: fkipId, study_level_id: s1Id },
    { code: "121", name: "Pendidikan Bahasa Indonesia", faculty_id: fkipId, study_level_id: s1Id },
    { code: "122", name: "Pendidikan Bahasa Inggris", faculty_id: fkipId, study_level_id: s1Id },
    { code: "123", name: "Pendidikan Matematika", faculty_id: fkipId, study_level_id: s1Id },
    { code: "124", name: "Pendidikan Biologi", faculty_id: fkipId, study_level_id: s1Id },
    { code: "125", name: "Pendidikan Fisika", faculty_id: fkipId, study_level_id: s1Id },
    { code: "126", name: "Pendidikan Kimia", faculty_id: fkipId, study_level_id: s1Id },
    { code: "127", name: "Pancasila & Kewarganegaraan", faculty_id: fkipId, study_level_id: s1Id },
    { code: "128", name: "Pendidikan Ekonomi", faculty_id: fkipId, study_level_id: s1Id },
    { code: "129", name: "Teknologi Pendidikan", faculty_id: fkipId, study_level_id: s1Id },

    // FEB - S1
    { code: "54", name: "Manajemen", faculty_id: feId, study_level_id: s1Id },
    { code: "83", name: "Akuntansi", faculty_id: feId, study_level_id: s1Id },
    { code: "55", name: "Ekonomi Pembangunan", faculty_id: feId, study_level_id: s1Id },
    { code: "56", name: "Ekonomi Syariah", faculty_id: feId, study_level_id: s1Id },
    { code: "57", name: "Pariwisata", faculty_id: feId, study_level_id: s1Id },
    { code: "58", name: "Kewirausahaan", faculty_id: feId, study_level_id: s1Id },
    { code: "59", name: "Akuntansi Keuangan Publik", faculty_id: feId, study_level_id: s1Id },

    // Diploma
    { code: "411", name: "D-IV Kearsipan", faculty_id: fhisipId, study_level_id: d4Id },
    { code: "412", name: "D-III Perpajakan", faculty_id: feId, study_level_id: d3Id },
  ];

  console.log(`Upserting ${studyProgramsToUpsert.length} study programs...`);

  const { data: upsertData, error: upsertErr } = await supabase
    .from("study_programs")
    .upsert(studyProgramsToUpsert, { onConflict: "code" })
    .select();

  if (upsertErr) {
    console.error("Upsert study_programs failed:", upsertErr.message);
    process.exit(1);
  }

  console.log("Upsert study_programs SUCCESS! Total rows:", upsertData.length);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
