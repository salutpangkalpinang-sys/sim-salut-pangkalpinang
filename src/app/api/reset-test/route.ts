import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Try stored procedures (bypasses RLS)
    const { data: resetDataRes, error: resetDataErr } = await supabase.rpc("reset_all_system_data");
    const { data: resetTxRes, error: resetTxErr } = await supabase.rpc("reset_all_system_transactions");

    // 2. Direct table wipes (in case RLS DELETE policy is applied)
    await supabase.from("ut_remittance_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("ut_remittance_void_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("ut_remittances").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("payment_allocations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("payment_void_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("student_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("invoice_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("lip_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("registration_fee_snapshots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("student_status_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("students").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("operational_transaction_void_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("operational_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return NextResponse.json({
      success: true,
      message: "Proses reset seluruh data transaksi dan data mahasiswa telah selesai dijalankan.",
      resetDataRes,
      resetTxRes,
      resetDataErr,
      resetTxErr,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to reset data" }, { status: 500 });
  }
}
