import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all students to match or list
    const { data: allStudents } = await supabase.from("students").select("id, full_name, nim");

    const dixitStudents = (allStudents || []).filter(
      (s) => s.full_name?.toLowerCase().includes("dixit") || s.full_name?.toLowerCase().includes("mutama")
    );

    const targetStudents = dixitStudents.length > 0 ? dixitStudents : allStudents || [];

    if (targetStudents.length === 0) {
      return NextResponse.json({ message: "No students found in system", allStudents });
    }

    const studentIds = targetStudents.map((s) => s.id);

    // Find registrations
    const { data: regs } = await supabase
      .from("registrations")
      .select("id, registration_number, student_id")
      .in("student_id", studentIds);

    const regIds = (regs || []).map((r) => r.id);

    if (regIds.length === 0) {
      return NextResponse.json({
        message: "No registrations found for target students",
        targetStudents,
        allStudents,
      });
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

    // 5. Delete Registration Fee Snapshots & Registrations
    await supabase.from("registration_fee_snapshots").delete().in("registration_id", regIds);
    const { error: regErr } = await supabase.from("registrations").delete().in("id", regIds);

    return NextResponse.json({
      success: true,
      message: "Data transaksi registrasi, LIP, invoice, pembayaran, & setoran UT berhasil di-reset bersih!",
      resetStudents: targetStudents.map((s) => s.full_name),
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
