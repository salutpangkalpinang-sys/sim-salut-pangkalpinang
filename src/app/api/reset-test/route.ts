import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Delete UT Remittance items, void requests, & remittances
    const { error: utItemErr } = await supabase.from("ut_remittance_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: utVoidErr } = await supabase.from("ut_remittance_void_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: utRemErr } = await supabase.from("ut_remittances").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. Delete Student Payments & Payment Allocations
    const { error: allocErr } = await supabase.from("payment_allocations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: payErr } = await supabase.from("student_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 3. Delete Invoice Items & Invoices
    const { error: invItemErr } = await supabase.from("invoice_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: invErr } = await supabase.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 4. Delete LIP Documents
    const { error: lipErr } = await supabase.from("lip_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 5. Delete Fee Snapshots & Registrations
    const { error: snapErr } = await supabase.from("registration_fee_snapshots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: regErr } = await supabase.from("registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 6. Delete Cash Transactions
    const { error: cashErr } = await supabase.from("cash_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return NextResponse.json({
      success: true,
      message: "SELURUH DATA TRANSAKSI SISTEM (Registrasi, LIP, Invoice, Pembayaran, Setoran UT, Kas Operasional) BERHASIL DIHAPUS BERSIH!",
      errors: {
        utItemErr,
        utVoidErr,
        utRemErr,
        allocErr,
        payErr,
        invItemErr,
        invErr,
        lipErr,
        snapErr,
        regErr,
        cashErr,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to wipe all system transactions" }, { status: 500 });
  }
}
