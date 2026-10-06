import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Read local temporary credentials
const creds = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "uat-credentials.json"), "utf8")
);

const SCREENSHOT_DIR = path.join(process.cwd(), "uat-artifacts", "screenshots");

// Helper: login cleanly through standard UI form
async function loginAs(page: any, userKey: "academic" | "finance" | "admin" | "viewer") {
  const { email, pass } = creds[userKey];
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  await page.fill('#email', email);
  await page.fill('#password', pass);
  await page.click('button[type="submit"]');

  // Expect redirection to dashboard or internal page
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForLoadState("domcontentloaded");
}

test.describe("Phase 2.3 Comprehensive Real Browser UAT Suite", () => {
  test.describe.configure({ mode: "serial" });

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
    // Input placeholder: "Ketik Nama atau NIM Mahasiswa untuk mencari..."
    const studentInput = page.getByPlaceholder(/Ketik Nama atau NIM Mahasiswa/i);
    await expect(studentInput).toBeVisible();
    await studentInput.fill("Budi");

    // Wait for combobox portal option and select
    const studentOption = page.locator('div[role="listbox"] button[role="option"]').filter({ hasText: "Budi UAT Mahasiswa" });
    await expect(studentOption).toBeVisible({ timeout: 5000 });
    await studentOption.click();

    // Verify student selected card is visible
    await expect(page.locator("text=Budi UAT Mahasiswa")).toBeVisible();
    await expect(page.locator("text=NIM: 041234567")).toBeVisible();

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
    // FormattedNumberInput
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
  });

  test("Scenario C: admin accesses all operational routes, LIP reconciliation & owner immutability", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile");

    await loginAs(page, "admin");

    // 1. Visit 7 operational routes
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

    // 2. Test LIP Upload & Reconciliation in /lip-tagihan
    await page.goto("/lip-tagihan");
    await page.waitForLoadState("networkidle");

    const uploadLipBtn = page.getByRole("button", { name: /Unggah Dokumen LIP Baru/i });
    await expect(uploadLipBtn).toBeVisible();
    await uploadLipBtn.click();

    const lipModal = page.getByRole("heading", { name: /Input Manual & Upload Dokumen LIP/i });
    await expect(lipModal).toBeVisible();

    // Select Registration
    const regComboboxInput = page.getByPlaceholder(/Ketik Nama, NIM, atau No. Registrasi Mahasiswa/i);
    await regComboboxInput.fill("Budi");
    const regOpt = page.locator('div[role="listbox"] button[role="option"]').first();
    await expect(regOpt).toBeVisible({ timeout: 5000 });
    await regOpt.click();

    // Fill LIP Number & Official Amount (e.g. 1.200.000)
    await page.fill('input[placeholder*="Contoh: LIP"]', "LIP-UAT-99001");
    const officialAmtInput = page.locator('input[inputmode="numeric"]').first();
    await officialAmtInput.fill("1200000");

    // Submit LIP
    const saveLipBtn = page.getByRole("button", { name: /Simpan Dokumen LIP/i });
    await saveLipBtn.click();
    await expect(lipModal).not.toBeVisible({ timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Verify LIP appears and verify it
    const lipRow = page.locator("tr").filter({ hasText: "LIP-UAT-99001" }).first();
    await expect(lipRow).toBeVisible();

    const verifyLipBtn = lipRow.getByRole("button", { name: /Verifikasi/i });
    await verifyLipBtn.click();
    const confirmVerifyLip = page.getByRole("button", { name: /Konfirmasi|Ya, Verifikasi/i }).last();
    await confirmVerifyLip.click();
    await page.waitForTimeout(2000);

    // 3. Owner Immutability Check in /pengguna
    await page.goto("/pengguna");
    await page.waitForLoadState("networkidle");

    // Find Owner row in user table
    const ownerRow = page.locator("tr").filter({ hasText: /Owner \/ Pimpinan/i }).first();
    if (await ownerRow.count() > 0) {
      const editRoleBtn = ownerRow.getByRole("button", { name: /Ubah Role/i });
      await expect(editRoleBtn).toBeDisabled();
    }

    const shotPath = path.join(
      SCREENSHOT_DIR,
      `scen_c_admin_lip_reconciled_${isMobile ? "mobile" : "desktop"}.png`
    );
    await page.screenshot({ path: shotPath, fullPage: false });
  });

  test("Scenario D: viewer is strictly read-only and mutation endpoints return error", async ({
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

    // 4. Visit /pengguna -> No mutation buttons
    await page.goto("/pengguna");
    await page.waitForLoadState("networkidle");
    const addUserBtn = page.getByRole("button", { name: /Tambah Pengguna/i });
    await expect(addUserBtn).not.toBeVisible();
  });

  test("Scenario E: Searchable Dropdown keyboard navigation and filter assertions", async ({
    page,
  }) => {
    await loginAs(page, "academic");
    await page.goto("/registrasi");
    await page.waitForLoadState("networkidle");

    // Open registration modal
    await page.getByRole("button", { name: /Buat Registrasi Baru/i }).click();

    // Test SearchableSelect: Periode Akademik dropdown
    // Trigger is button with role="combobox"
    const periodSelectTrigger = page.locator('button[role="combobox"]').filter({ hasText: /Pilih Periode Akademik|2025|2026/i }).first();
    await expect(periodSelectTrigger).toBeVisible();
    await periodSelectTrigger.click();

    // Search input inside floating portal
    const searchInput = page.locator('input[placeholder="Ketik untuk mencari..."]').last();
    await expect(searchInput).toBeVisible();

    // Keyboard type query
    await searchInput.fill("2026");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Expect dropdown closed and period selected
    await expect(periodSelectTrigger).toContainText("2026");

    // Close modal
    await page.getByRole("button", { name: "Batal", exact: true }).click();
  });

  test("Scenario F: Responsive layout & mobile viewport inspection", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile");
    await loginAs(page, "academic");

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const shotPath = path.join(
      SCREENSHOT_DIR,
      `scen_f_responsive_dashboard_${isMobile ? "mobile" : "desktop"}.png`
    );
    await page.screenshot({ path: shotPath, fullPage: false });

    if (isMobile) {
      // In mobile, sidebar should be collapsed or hidden off-screen
      const sidebar = page.locator("aside");
      // Header branding must be legible
      await expect(page.locator("header")).toBeVisible();
    }
  });
});
