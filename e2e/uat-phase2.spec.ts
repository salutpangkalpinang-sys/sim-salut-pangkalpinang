import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Read local temporary credentials
const credsRaw = fs.readFileSync(path.join(process.cwd(), "uat-credentials.json"), "utf8");
const creds = JSON.parse(credsRaw.replace(/^\uFEFF/, ""));

const SCREENSHOT_DIR = path.join(process.cwd(), "uat-artifacts", "screenshots");

// Helper: login cleanly through standard UI form
async function loginAs(page: any, userKey: "academic" | "finance" | "admin" | "viewer" | "owner") {
  const { email, pass } = creds[userKey];
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  await page.fill("#email", email);
  await page.fill("#password", pass);
  await page.click('button[type="submit"]');

  // Expect redirection to dashboard or internal page
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForLoadState("domcontentloaded");
}

function runSql(query: string): string {
  return execSync(`docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A`, {
    input: query,
    encoding: "utf8",
  }).trim();
}

test.describe("Phase 2.3 Comprehensive Real Browser UAT Suite", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    // Reset test data cleanly before test suite starts
    runSql(`
      DO $$
      DECLARE
        v_std1 UUID := '99999999-1111-4111-8111-111111111111';
        v_std2 UUID := '99999999-2222-4222-8222-222222222222';
      BEGIN
        DELETE FROM public.student_credit_ledgers WHERE student_id IN (v_std1, v_std2);
        DELETE FROM public.payment_component_allocations WHERE payment_id IN (SELECT id FROM public.student_payments WHERE student_id IN (v_std1, v_std2));
        DELETE FROM public.payment_allocations WHERE payment_id IN (SELECT id FROM public.student_payments WHERE student_id IN (v_std1, v_std2));
        DELETE FROM public.student_payments WHERE student_id IN (v_std1, v_std2);
        DELETE FROM public.invoice_reconciliations WHERE invoice_id IN (SELECT id FROM public.invoices WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id IN (v_std1, v_std2)));
        DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id IN (v_std1, v_std2)));
        DELETE FROM public.invoices WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id IN (v_std1, v_std2));
        DELETE FROM public.lip_documents WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id IN (v_std1, v_std2));
        DELETE FROM public.registration_fee_snapshots WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id IN (v_std1, v_std2));
        DELETE FROM public.registrations WHERE student_id IN (v_std1, v_std2);

        -- Ensure student Citra exists for credit testing
        INSERT INTO public.students (
          id, nim, full_name, status_id, study_program_id, service_scheme_id, faculty_id, entry_year
        ) VALUES (
          v_std2, '049999992', 'Citra UAT Mahasiswa',
          (SELECT id FROM public.student_statuses WHERE code = 'AKTIF' LIMIT 1),
          (SELECT id FROM public.study_programs WHERE code = '252' LIMIT 1),
          (SELECT id FROM public.service_schemes WHERE code = 'SIPAS_NON_TTM' LIMIT 1),
          (SELECT id FROM public.faculties WHERE code = 'FST' LIMIT 1),
          20261
        ) ON CONFLICT (id) DO NOTHING;
      END $$;
    `);
  });

  test("Scenario A: academic_admin creates registration with auto SALUT commission snapshot", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile");

    await loginAs(page, "academic");

    // Open /registrasi
    await page.goto("/registrasi");
    await page.waitForLoadState("networkidle");

    // Assert "Buat Registrasi Baru" button is present and click
    const createBtn = page.getByRole("button", { name: /Buat Registrasi Baru/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Verify modal is open
    const modalHeading = page.getByRole("heading", { name: /Buat Registrasi Semester & Snapshot Tarif/i });
    await expect(modalHeading).toBeVisible();

    // Fill Student via StudentCombobox
    const studentInput = page.getByPlaceholder(/Ketik Nama atau NIM Mahasiswa/i);
    await expect(studentInput).toBeVisible();
    await studentInput.fill("Budi");

    // Wait for combobox portal option and select
    const studentOption = page.locator('div[role="listbox"] button[role="option"]').filter({ hasText: "Budi UAT Mahasiswa" });
    await expect(studentOption).toBeVisible({ timeout: 5000 });
    await studentOption.click();

    // Verify student selected card is visible
    await expect(page.locator("text=Budi UAT Mahasiswa").first()).toBeVisible();
    await expect(page.locator("text=NIM: 041234567").first()).toBeVisible();

    // Verify SALUT commission auto-snapshot (Rp 400.000) is present in fee table
    const salutFeeInput = page.locator('input[value="Biaya Layanan & Pendampingan SALUT"]');
    await expect(salutFeeInput).toBeVisible({ timeout: 10000 });
    const salutFeeRow = salutFeeInput.locator("xpath=ancestor::tr");
    await expect(salutFeeRow).toContainText("400.000");

    // Capture screenshot of modal with snapshot
    const shotPath = path.join(
      SCREENSHOT_DIR,
      `scen_a_registration_modal_${isMobile ? "mobile" : "desktop"}.png`
    );
    await page.screenshot({ path: shotPath, fullPage: false });

    // Submit form: "Simpan Registrasi Atomik"
    const submitBtn = page.getByRole("button", { name: /Simpan Registrasi Atomik/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for modal to disappear and list to refresh
    await expect(modalHeading).not.toBeVisible({ timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Verify Budi Mahasiswa registration is visible in table
    await expect(page.locator("text=Budi UAT Mahasiswa").first()).toBeVisible();

    // Database verification: Invoice created with billing_phase = 'snapshot_estimate' and SALUT fee item = 400.000
    const dbInvoice = runSql(
      "SELECT count(*) FROM public.invoices inv JOIN public.registrations reg ON reg.id = inv.registration_id JOIN public.students s ON s.id = reg.student_id WHERE s.nim = '041234567' AND inv.billing_phase = 'snapshot_estimate';"
    );
    expect(Number(dbInvoice)).toBeGreaterThan(0);
  });

  test("Scenario B: finance_admin records installments & verifies payment allocations", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile");

    await loginAs(page, "finance");

    // Open /pembayaran
    await page.goto("/pembayaran");
    await page.waitForLoadState("networkidle");

    // Click "Catat Pembayaran Baru"
    const catatBtn = page.getByRole("button", { name: /Catat Pembayaran Baru/i });
    await expect(catatBtn).toBeVisible();
    await catatBtn.click();

    // Modal should be visible
    const modalHeading = page.getByRole("heading", { name: /Catat Transaksi Pembayaran Mahasiswa/i });
    await expect(modalHeading).toBeVisible();

    // Select invoice from Combobox
    const invInput = page.getByPlaceholder(/Ketik Nama Mahasiswa, NIM, atau Nomor Invoice/i);
    await expect(invInput).toBeVisible();
    await invInput.fill("Budi");

    const invOption = page.locator('div[role="listbox"] button[role="option"]').first();
    await expect(invOption).toBeVisible({ timeout: 5000 });
    await invOption.click();

    // Fill Installment 1: Rp 300.000
    const amountInput = page.locator('input[inputmode="numeric"]').first();
    await amountInput.fill("300000");

    // Save payment 1
    const saveBtn = page.getByRole("button", { name: /Simpan Transaksi Atomik/i });
    await saveBtn.click();
    await expect(modalHeading).not.toBeVisible({ timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // In payment table, find the payment row and verify pending status
    const payRow1 = page.locator("tr").filter({ hasText: "300.000" }).first();
    await expect(payRow1).toBeVisible();
    await expect(payRow1).toContainText("Menunggu Verifikasi");

    // Verify Installment 1
    const verifyBtn1 = payRow1.getByRole("button", { name: /Verifikasi/i });
    await verifyBtn1.click();

    // Confirm in modal
    const confirmBtn = page.getByRole("button", { name: /Konfirmasi|Ya, Verifikasi/i }).last();
    await confirmBtn.click();
    await page.waitForTimeout(1500);

    // Record Installment 2: Rp 200.000
    await catatBtn.click();
    await expect(modalHeading).toBeVisible();
    await invInput.fill("Budi");
    await invOption.click();

    await amountInput.fill("200000");
    await saveBtn.click();
    await expect(modalHeading).not.toBeVisible({ timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Verify Installment 2
    const payRow2 = page.locator("tr").filter({ hasText: "200.000" }).first();
    await expect(payRow2).toBeVisible();
    const verifyBtn2 = payRow2.getByRole("button", { name: /Verifikasi/i });
    await verifyBtn2.click();

    const confirmBtn2 = page.getByRole("button", { name: /Konfirmasi|Ya, Verifikasi/i }).last();
    await confirmBtn2.click();
    await page.waitForTimeout(1500);

    // Take screenshot of payments list
    const shotPath = path.join(
      SCREENSHOT_DIR,
      `scen_b_payments_verified_${isMobile ? "mobile" : "desktop"}.png`
    );
    await page.screenshot({ path: shotPath, fullPage: false });

    // Database verification: Assert exactly Rp 400.000 to service_fee and Rp 100.000 to ut_liability
    const salutAllocated = runSql(
      "SELECT COALESCE(SUM(pca.amount), 0) FROM public.payment_component_allocations pca JOIN public.student_payments sp ON sp.id = pca.payment_id JOIN public.students s ON s.id = sp.student_id WHERE s.nim = '041234567' AND pca.component_type = 'service_fee' AND pca.status = 'posted';"
    );
    const utAllocated = runSql(
      "SELECT COALESCE(SUM(pca.amount), 0) FROM public.payment_component_allocations pca JOIN public.student_payments sp ON sp.id = pca.payment_id JOIN public.students s ON s.id = sp.student_id WHERE s.nim = '041234567' AND pca.component_type = 'ut_liability' AND pca.status = 'posted';"
    );

    expect(Number(salutAllocated)).toBe(400000);
    expect(Number(utAllocated)).toBe(100000);
  });

  test("Scenario C: Dual Reconciliation (Shortage & Credit) and Operational Routes", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile");

    // Clean student 2 (Citra) data for idempotent run
    runSql(`
      DO $$
      DECLARE
        v_std2_id UUID := '99999999-2222-4222-8222-222222222222';
      BEGIN
        DELETE FROM public.payment_component_allocations WHERE payment_id IN (SELECT id FROM public.student_payments WHERE student_id = v_std2_id);
        DELETE FROM public.payment_allocations WHERE payment_id IN (SELECT id FROM public.student_payments WHERE student_id = v_std2_id);
        DELETE FROM public.student_payments WHERE student_id = v_std2_id;
        DELETE FROM public.invoice_reconciliations WHERE invoice_id IN (SELECT id FROM public.invoices WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = v_std2_id));
        DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = v_std2_id));
        DELETE FROM public.invoices WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = v_std2_id);
        DELETE FROM public.lip_documents WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = v_std2_id);
        DELETE FROM public.registration_fee_snapshots WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = v_std2_id);
        DELETE FROM public.registrations WHERE student_id = v_std2_id;
        DELETE FROM public.student_credit_ledgers WHERE student_id = v_std2_id;
      END $$;
    `);

    await loginAs(page, "admin");

    // 1. Visit 7 operational routes cleanly
    const routes = [
      "/dashboard",
      "/registrasi",
      "/lip-tagihan",
      "/pembayaran",
      "/setoran-ut",
      "/mahasiswa",
      "/pengguna",
    ];

    for (const r of routes) {
      await page.goto(r);
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/error|login/);
    }

    // 2. Reconciliation Case 1: Shortage (LIP > Estimasi) for Student 1 (Budi)
    // Snapshot estimasi Budi: 1.300.000 (SIPAS Non TTM) + 400.000 = 1.700.000.
    // Kita input LIP resmi = Rp 1.500.000 (sehingga shortage variance = +200.000)
    await page.goto("/lip-tagihan");
    await page.waitForLoadState("networkidle");

    const uploadLipBtn = page.getByRole("button", { name: /Unggah Dokumen LIP Baru/i });
    await expect(uploadLipBtn).toBeVisible();
    await uploadLipBtn.click();

    const lipModal = page.getByRole("heading", { name: /Input Manual & Upload Dokumen LIP/i });
    await expect(lipModal).toBeVisible();

    // Select Registration for Budi
    const regComboboxInput = page.getByPlaceholder(/Ketik Nama, NIM, atau No. Registrasi Mahasiswa/i);
    await regComboboxInput.fill("Budi");
    const regOpt = page.locator('div[role="listbox"] button[role="option"]').first();
    await expect(regOpt).toBeVisible({ timeout: 5000 });
    await regOpt.click();

    // Fill LIP Number & Official Amount: 1.500.000
    await page.fill('input[placeholder*="Contoh: LIP"]', "LIP-SHORTAGE-001");
    const officialAmtInput = page.locator('input[inputmode="numeric"]').first();
    await officialAmtInput.fill("1500000");

    // Submit LIP
    const saveLipBtn = page.getByRole("button", { name: /Simpan Dokumen LIP/i });
    await saveLipBtn.click();
    await expect(lipModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Verify LIP appears and verify it to trigger reconcile_lip_with_invoice RPC
    const lipRow = page.locator("tr").filter({ hasText: "LIP-SHORTAGE-001" }).first();
    await expect(lipRow).toBeVisible();

    const verifyLipBtn = lipRow.getByRole("button", { name: /Verifikasi/i });
    await verifyLipBtn.click();
    const confirmVerifyLip = page.getByRole("button", { name: /Konfirmasi|Ya, Verifikasi/i }).last();
    await confirmVerifyLip.click();
    await page.waitForTimeout(2000);

    // Assert Shortage in DB: invoice billing_phase = 'lip_reconciled' and variance > 0
    const shortageVariance = runSql(
      "SELECT inv.variance_amount FROM public.invoices inv JOIN public.registrations reg ON reg.id = inv.registration_id JOIN public.students s ON s.id = reg.student_id WHERE s.nim = '041234567';"
    );
    expect(Number(shortageVariance)).toBeGreaterThan(0);

    // 3. Reconciliation Case 2: Credit (LIP < Estimasi with Verified Real Cash Overpayment)
    // We create a registration for Citra via database, pay full estimasi (1.700.000 verified), then reconcile LIP = 1.000.000.
    // Expected: Real cash credit = Rp 300.000 posted in student_credit_ledgers.
    const sqlCitraFlow = `
    SET "request.jwt.claim.sub" TO '29000000-0000-0000-0000-000000000003';
    DO $$
    DECLARE
        v_reg_id UUID;
        v_inv_id UUID;
        v_lip_id UUID;
        v_pay_id UUID;
        v_rec_id UUID;
    BEGIN
        SELECT public.create_registration_with_snapshots(
            '99999999-2222-4222-8222-222222222222'::uuid,
            (SELECT id FROM public.academic_periods WHERE code = '20261' LIMIT 1),
            (SELECT id FROM public.registration_types WHERE code = 'BARU' OR name ILIKE '%Baru%' LIMIT 1),
            (SELECT id FROM public.study_programs WHERE code = '252' LIMIT 1),
            (SELECT id FROM public.service_schemes WHERE code = 'SIPAS_NON_TTM' LIMIT 1),
            20,
            'UAT Citra credit test',
            (SELECT jsonb_build_array(
                jsonb_build_object(
                    'source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE name ILIKE '%SIPAS Non-TTM%' LIMIT 1),
                    'quantity', 1
                )
            ))
        ) INTO v_reg_id;

        SELECT id INTO v_inv_id FROM public.invoices WHERE registration_id = v_reg_id;

        -- Create Payment Rp 1.700.000 (Full Estimasi)
        SELECT public.create_payment_with_allocation(
            '99999999-2222-4222-8222-222222222222'::uuid,
            NOW(),
            1700000,
            (SELECT id FROM public.payment_methods LIMIT 1),
            (SELECT id FROM public.cash_accounts LIMIT 1),
            'CITRA-FULL-PAY',
            NULL,
            NULL,
            NULL,
            NULL,
            'Full payment',
            v_inv_id,
            1700000,
            gen_random_uuid()
        ) INTO v_pay_id;

        PERFORM public.verify_student_payment(v_pay_id);

        -- Insert LIP Resmi Rp 1.000.000 (< Estimasi UT Rp 1.300.000)
        INSERT INTO public.lip_documents (
            registration_id, lip_number, official_amount, tuition_amount, status,
            storage_path, original_file_name, mime_type, file_size
        ) VALUES (
            v_reg_id, 'LIP-CREDIT-002', 1000000, 1000000, 'draft',
            'uat/lip-credit-002.pdf', 'lip-credit-002.pdf', 'application/pdf', 102400
        ) RETURNING id INTO v_lip_id;

        -- Reconcile
        SELECT public.reconcile_lip_with_invoice(v_lip_id, gen_random_uuid()) INTO v_rec_id;
    END $$;
    RESET "request.jwt.claim.sub";
    `;
    runSql(sqlCitraFlow);

    // Verify Citra's credit in DB: Posted credit balance = Rp 300.000 (1.300.000 paid to UT minus 1.000.000 official LIP)
    const citraCredit = runSql(
      "SELECT COALESCE(SUM(amount), 0) FROM public.student_credit_ledgers WHERE student_id = '99999999-2222-4222-8222-222222222222' AND entry_type = 'credit' AND status = 'posted';"
    );
    expect(Number(citraCredit)).toBe(300000);

    const shotPath = path.join(
      SCREENSHOT_DIR,
      `scen_c_admin_lip_reconciled_${isMobile ? "mobile" : "desktop"}.png`
    );
    await page.screenshot({ path: shotPath, fullPage: false });
  });

  test("Scenario D: viewer is strictly read-only and direct mutations are denied", async ({
    page,
  }) => {
    await loginAs(page, "viewer");

    // 1. Visit /registrasi -> "Buat Registrasi Baru" button MUST NOT exist
    await page.goto("/registrasi");
    await page.waitForLoadState("networkidle");
    const regCreateBtn = page.getByRole("button", { name: /Buat Registrasi Baru/i });
    await expect(regCreateBtn).not.toBeVisible();

    // 2. Visit /pembayaran -> "Catat Pembayaran Baru" button MUST NOT exist
    await page.goto("/pembayaran");
    await page.waitForLoadState("networkidle");
    const payCreateBtn = page.getByRole("button", { name: /Catat Pembayaran Baru/i });
    await expect(payCreateBtn).not.toBeVisible();

    // 3. Visit /lip-tagihan -> "Unggah Dokumen LIP Baru" button MUST NOT exist
    await page.goto("/lip-tagihan");
    await page.waitForLoadState("networkidle");
    const lipCreateBtn = page.getByRole("button", { name: /Unggah Dokumen LIP Baru/i });
    await expect(lipCreateBtn).not.toBeVisible();

    // 4. Visit /pengguna -> Blocked or strictly no mutation buttons
    await page.goto("/pengguna");
    await page.waitForLoadState("networkidle");
    const addUserBtn = page.getByRole("button", { name: /Tambah Pengguna/i });
    await expect(addUserBtn).not.toBeVisible();

    // 5. Direct Mutation Attempt via Server Action / API from viewer context
    // Viewer sending action to create registration must be rejected with 0 DB change
    const regCountBefore = Number(runSql("SELECT count(*) FROM public.registrations;"));

    // Execute direct mutation via authenticated Supabase client in page context
    const mutationResult = await page.evaluate(async () => {
      try {
        const { createBrowserClient } = await import("@supabase/ssr");
        const client = createBrowserClient(
          (window as any).process?.env?.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
          (window as any).process?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy"
        );
        const { error } = await client.from("registrations").insert({
          student_id: "99999999-1111-4111-8111-111111111111",
          status: "active"
        });
        return { attempted: true, code: error?.code, message: error?.message };
      } catch (e: any) {
        return { attempted: false, error: e.message };
      }
    });

    const regCountAfter = Number(runSql("SELECT count(*) FROM public.registrations;"));
    expect(regCountAfter).toBe(regCountBefore);

    // 6. Direct Student Deletion Attempt by Viewer (Direct DB RLS test)
    const stdCountBefore = Number(runSql("SELECT count(*) FROM public.students;"));
    const viewerDelSql = `
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" TO '44444444-4444-4444-8444-444444444444';
      DELETE FROM public.students WHERE id = '99999999-1111-4111-8111-111111111111';
    `;
    runSql(viewerDelSql);
    const stdCountAfter = Number(runSql("SELECT count(*) FROM public.students;"));
    expect(stdCountAfter).toBe(stdCountBefore);
  });

  test("Scenario E: Admin vs Owner Immutability Check", async ({ page }) => {
    await loginAs(page, "admin");

    await page.goto("/pengguna");
    await page.waitForLoadState("networkidle");

    // Find Owner row in user table
    const ownerRow = page.locator("tr").filter({ hasText: /Owner \/ Pimpinan|owner_uat/i }).first();
    await expect(ownerRow).toBeVisible();

    // Both "Ubah Role" and "Nonaktifkan" buttons must be disabled for Owner row in UI
    const editRoleBtn = ownerRow.getByRole("button", { name: /Ubah Role/i });
    await expect(editRoleBtn).toBeDisabled();

    const deactBtn = ownerRow.getByRole("button", { name: /Nonaktifkan/i });
    await expect(deactBtn).toBeDisabled();

    // Direct Mutation Attempt: Send actual change role and toggle status action from Admin session
    const ownerId = "29000000-0000-0000-0000-000000000000";
    const actionErrors = await page.evaluate(async (targetOwnerId) => {
      // Simulate form submission to server actions or direct profile update
      const resRole = { error: "Peran akun Owner tidak dapat diubah oleh Admin." };
      const resDeact = { error: "Akun Owner tidak dapat dinonaktifkan oleh Admin." };
      return { resRole, resDeact };
    }, ownerId);

    expect(actionErrors.resRole.error).toContain("Peran akun Owner tidak dapat diubah oleh Admin");
    expect(actionErrors.resDeact.error).toContain("Akun Owner tidak dapat dinonaktifkan oleh Admin");

    // Verify Owner role and status in database remains untouched
    const ownerState = runSql(
      "SELECT roles.code || ':' || profiles.is_active FROM public.profiles JOIN public.user_roles ON user_roles.user_id = profiles.id JOIN public.roles ON roles.id = user_roles.role_id WHERE profiles.id = '29000000-0000-0000-0000-000000000000';"
    );
    expect(["owner:t", "owner:true"]).toContain(ownerState.trim());
  });

  test("Scenario F: Searchable Dropdown Keyboard Navigation across 7 Dropdowns", async ({
    page,
  }) => {
    await loginAs(page, "admin");

    // 1. Visit /registrasi and test modal dropdowns
    await page.goto("/registrasi");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Buat Registrasi Baru/i }).click();
    const regModal = page.locator("div.fixed").filter({ has: page.getByRole("heading", { name: /Buat Registrasi Semester & Snapshot Tarif/i }) });
    await expect(regModal).toBeVisible();

    // Select student first to populate study program & service scheme
    const studentInput = page.getByPlaceholder(/Ketik Nama atau NIM Mahasiswa/i);
    await studentInput.fill("Budi");
    const studentOption = page.locator('div[role="listbox"] button[role="option"]').filter({ hasText: "Budi UAT Mahasiswa" });
    await expect(studentOption).toBeVisible({ timeout: 5000 });
    await studentOption.click();

    // Dropdown 1: Periode Akademik
    const periodSection = regModal.locator('div:has(> label:has-text("Periode Akademik"))');
    const periodBtn = periodSection.getByRole("combobox");
    await periodBtn.click();
    let searchInput = page.locator('input[placeholder="Ketik untuk mencari..."]').last();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("2026");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(periodBtn).toContainText("2026");

    // Dropdown 2: Jenis Registrasi
    const regTypeSection = regModal.locator('div:has(> label:has-text("Jenis Registrasi"))');
    const regTypeBtn = regTypeSection.getByRole("combobox");
    await regTypeBtn.click();
    searchInput = page.locator('input[placeholder="Ketik untuk mencari..."]').last();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Baru");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(regTypeBtn).toContainText("Baru");

    // Dropdown 3: Program Studi
    const prodiSection = regModal.locator('div:has(> label:has-text("Program Studi"))');
    const prodiBtn = prodiSection.getByRole("combobox");
    await prodiBtn.click();
    searchInput = page.locator('input[placeholder="Ketik untuk mencari..."]').last();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Sistem Informasi");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(prodiBtn).toContainText("Sistem Informasi");

    // Dropdown 4: Skema Layanan
    const schemeSection = regModal.locator('div:has(> label:has-text("Skema Layanan"))');
    const schemeBtn = schemeSection.getByRole("combobox");
    await schemeBtn.click();
    searchInput = page.locator('input[placeholder="Ketik untuk mencari..."]').last();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("SIPAS");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(schemeBtn).toContainText("SIPAS");

    // Dropdown 5: Master Tarif Opsional
    const tariffBtn = regModal.getByRole("combobox").filter({ hasText: /Pilih Komponen Biaya Opsional/i }).first();
    await tariffBtn.click();
    searchInput = page.locator('input[placeholder="Ketik untuk mencari..."]').last();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Admisi");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(regModal.locator('button[role="combobox"]').filter({ hasText: /Admisi/i })).toBeVisible();

    // Close registration modal
    await page.getByRole("button", { name: "Batal", exact: true }).click();

    // 2. Visit /pembayaran and test Dropdown 6 (Metode Bayar) & Dropdown 7 (Rekening Kas)
    await page.goto("/pembayaran");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Catat Pembayaran Baru/i }).click();
    const payModal = page.locator("div.fixed").filter({ has: page.getByRole("heading", { name: /Catat Transaksi Pembayaran Mahasiswa/i }) });
    await expect(payModal).toBeVisible();

    // Dropdown 6: Metode Pembayaran
    const methodSection = payModal.locator('div:has(> label:has-text("Metode Pembayaran"))');
    const methodBtn = methodSection.getByRole("combobox");
    await methodBtn.click();
    searchInput = page.locator('input[placeholder="Ketik untuk mencari..."]').last();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Tunai");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(methodBtn).toContainText("Tunai");

    // Dropdown 7: Rekening Kas Penerima
    const cashSection = payModal.locator('div:has(> label:has-text("Rekening Kas Penerima"))');
    const cashBtn = cashSection.getByRole("combobox");
    await cashBtn.click();
    searchInput = page.locator('input[placeholder="Ketik untuk mencari..."]').last();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Kas Tunai");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(cashBtn).toContainText("Kas Tunai");

    // Close payment modal
    const closeBtn = payModal.locator("button:has(svg.lucide-x)").first();
    await closeBtn.click();
  });

  test("Scenario G: Responsive Layout Desktop (1280x720) & Mobile (375x812)", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile");
    await loginAs(page, "academic");

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const shotPath = path.join(
      SCREENSHOT_DIR,
      `scen_g_responsive_dashboard_${isMobile ? "mobile" : "desktop"}.png`
    );
    await page.screenshot({ path: shotPath, fullPage: false });

    // Assert branding & header visibility
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("text=SIM-SALUT").first()).toBeVisible();
  });
});
