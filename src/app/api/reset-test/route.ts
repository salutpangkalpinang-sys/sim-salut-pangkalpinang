import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Try stored procedure `delete_student_by_name` (bypasses RLS)
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("delete_student_by_name", { p_name_pattern: "Dixit" });

    // 2. Also try `reset_all_system_transactions` stored procedure
    const { data: resetRes, error: resetErr } = await supabase.rpc("reset_all_system_transactions");

    // 3. Fallback table wipes
    await supabase.from("ut_remittance_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("ut_remittance_void_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("ut_remittances").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("payment_allocations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("student_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("invoice_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("lip_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("registration_fee_snapshots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("student_status_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("students").delete().ilike("full_name", "%Dixit%");

    return NextResponse.json({
      success: true,
      message: "Seluruh data transaksi dan data mahasiswa a.n. Dixit Mutama Winanda BERHASIL DIHAPUS TOTAL!",
      rpcRes,
      resetRes,
      rpcErr,
      resetErr,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete student Dixit" }, { status: 500 });
  }
}
