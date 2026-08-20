import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Find student Dixit
    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("id, full_name")
      .ilike("full_name", "%Dixit%");

    if (sErr || !students || students.length === 0) {
      return NextResponse.json({ message: "Student Dixit not found", error: sErr });
    }

    const studentIds = students.map((s) => s.id);

    // Find registrations
    const { data: regs } = await supabase
      .from("registrations")
      .select("id")
      .in("student_id", studentIds);

    const regIds = (regs || []).map((r) => r.id);

    if (regIds.length === 0) {
      return NextResponse.json({ message: "No registrations found for Dixit" });
    }

    // 1. Delete UT Remittance Items
    const { error: utErr } = await supabase
      .from("ut_remittance_items")
      .delete()
      .in("registration_id", regIds);

    // 2. Delete Student Payments & Payment Allocations
    const { data: payments } = await supabase
      .from("student_payments")
      .select("id")
      .in("registration_id", regIds);

    const paymentIds = (payments || []).map((p) => p.id);
    if (paymentIds.length > 0) {
      await supabase.from("payment_allocations").delete().in("payment_id", paymentIds);
      await supabase.from("student_payments").delete().in("id", paymentIds);
    }

    // 3. Delete Invoice Items & Invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id")
      .in("registration_id", regIds);

    const invoiceIds = (invoices || []).map((i) => i.id);
    if (invoiceIds.length > 0) {
      await supabase.from("invoice_items").delete().in("invoice_id", invoiceIds);
      await supabase.from("invoices").delete().in("id", invoiceIds);
    }

    // 4. Delete LIP Documents
    const { error: lipErr } = await supabase
      .from("lip_documents")
      .delete()
      .in("registration_id", regIds);

    // 5. Delete Registration Fee Snapshots & Registrations (or reset status)
    await supabase.from("registration_fee_snapshots").delete().in("registration_id", regIds);
    const { error: regErr } = await supabase.from("registrations").delete().in("id", regIds);

    return NextResponse.json({
      success: true,
      message: "Data transaksi uji coba a.n. Dixit Mutama Winanda berhasil di-reset bersih!",
      resetCount: {
        registrations: regIds.length,
        invoices: invoiceIds.length,
        payments: paymentIds.length,
        utErr,
        lipErr,
        regErr,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to reset test data" }, { status: 500 });
  }
}
