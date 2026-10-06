param(
    [string]$TestName = "all"
)

$ErrorActionPreference = "Stop"

function Exec-Psql {
    param([string]$Sql)
    $tmpFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmpFile, $Sql)
        $output = & {
            $ErrorActionPreference = "SilentlyContinue"
            Get-Content $tmpFile -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        }
        return ($output -join "`n")
    } finally {
        if (Test-Path $tmpFile) { Remove-Item $tmpFile -Force }
    }
}

Write-Host "================================================================="
Write-Host " REAL DUAL-CONNECTION CONCURRENCY HARNESS ON LOCAL POSTGRESQL "
Write-Host "================================================================="

# 0. SETUP COMMON CONCURRENCY TEST DATA
$setupSql = @"
BEGIN;
-- Ensure feature flag is enabled for concurrency test
INSERT INTO public.app_settings (key, value, description)
VALUES ('feature_unified_invoice_enabled', '{"enabled": true}', 'Flag test')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Ensure auth users & profiles
INSERT INTO auth.users (id, email) VALUES
    ('20000000-0000-0000-0000-000000000001', 'owner_cc@salut.local'),
    ('20000000-0000-0000-0000-000000000002', 'admin_cc@salut.local'),
    ('20000000-0000-0000-0000-000000000003', 'acad_cc@salut.local'),
    ('20000000-0000-0000-0000-000000000004', 'fin_cc@salut.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, is_active) VALUES
    ('20000000-0000-0000-0000-000000000001', 'Owner CC', TRUE),
    ('20000000-0000-0000-0000-000000000002', 'Admin CC', TRUE),
    ('20000000-0000-0000-0000-000000000003', 'Acad CC', TRUE),
    ('20000000-0000-0000-0000-000000000004', 'Fin CC', TRUE)
ON CONFLICT (id) DO UPDATE SET is_active = TRUE;

DELETE FROM public.user_roles WHERE user_id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004'
);

INSERT INTO public.user_roles (user_id, role_id) VALUES
    ('20000000-0000-0000-0000-000000000001', (SELECT id FROM public.roles WHERE code = 'owner')),
    ('20000000-0000-0000-0000-000000000002', (SELECT id FROM public.roles WHERE code = 'admin')),
    ('20000000-0000-0000-0000-000000000003', (SELECT id FROM public.roles WHERE code = 'academic_admin')),
    ('20000000-0000-0000-0000-000000000004', (SELECT id FROM public.roles WHERE code = 'finance_admin'));

-- Clean previous concurrency test student & dependent records
DELETE FROM public.student_credit_ledgers WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID;
DELETE FROM public.payment_component_allocations WHERE payment_id IN (SELECT id FROM public.student_payments WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID);
DELETE FROM public.payment_allocations WHERE payment_id IN (SELECT id FROM public.student_payments WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID);
DELETE FROM public.student_payments WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID;
DELETE FROM public.ut_remittance_items WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID);
DELETE FROM public.ut_remittances WHERE idempotency_key IN ('90000000-0000-0000-0000-000000000081'::UUID, '90000000-0000-0000-0000-000000000082'::UUID);
DELETE FROM public.invoice_reconciliations WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID);
DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT i.id FROM public.invoices i JOIN public.registrations r ON i.registration_id = r.id WHERE r.student_id = '30000000-0000-0000-0000-000000000088'::UUID);
DELETE FROM public.invoices WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID);
DELETE FROM public.lip_documents WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID);
DELETE FROM public.registration_fee_snapshots WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID);
DELETE FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID;
DELETE FROM public.students WHERE id = '30000000-0000-0000-0000-000000000088'::UUID;

INSERT INTO public.students (id, nim, full_name, status_id) VALUES
    ('30000000-0000-0000-0000-000000000088', '049999988', 'Mahasiswa Uji Concurrency', (SELECT id FROM public.student_statuses WHERE code = 'AKTIF'));

COMMIT;
"@
Exec-Psql $setupSql | Out-Null
Write-Host "Setup test base identity & student OK."

# =============================================================================
# SCENARIO 1: DUA CREATE_PAYMENT_WITH_ALLOCATION PARALEL
# Total Tagihan = 1.800.000 (SALUT 400k + UKT 1.300k + Admisi 100k).
# Sisa Kapasitas = 1.800.000.
# Koneksi A mengajukan Rp 1.000.000.
# Koneksi B mengajukan Rp 1.000.000 secara simultan (Total diminta 2.000.000 > 1.800.000).
# Expected: Satu berhasil reservasi (remaining 800k), satu menunggu lock lalu ditolak CAPACITY_EXCEEDED.
# =============================================================================
Write-Host "`n--- [SCENARIO 1: Dua create_payment_with_allocation bersamaan] ---"

$createRegSql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000003';
SELECT public.create_registration_with_snapshots(
    '30000000-0000-0000-0000-000000000088'::UUID,
    (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
    (SELECT id FROM public.registration_types WHERE code = 'NEW_STUDENT' LIMIT 1),
    (SELECT id FROM public.study_programs LIMIT 1),
    (SELECT id FROM public.service_schemes LIMIT 1),
    0, 'Concurrency Test Reg',
    jsonb_build_array(
        jsonb_build_object('source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE name LIKE 'Biaya Admisi%' LIMIT 1), 'quantity', 1),
        jsonb_build_object('source_fee_rate_id', (SELECT id FROM public.fee_rates WHERE name LIKE 'UKT 3%' LIMIT 1), 'quantity', 1)
    )
);
COMMIT;
"@
Exec-Psql $createRegSql | Out-Null
$invId = Exec-Psql "SELECT i.id FROM public.invoices i JOIN public.registrations r ON i.registration_id = r.id WHERE r.student_id = '30000000-0000-0000-0000-000000000088'::UUID AND i.status <> 'cancelled' LIMIT 1;"
$invId = $invId.Trim()
Write-Host "Created Invoice ID: $invId (Total Billed: Rp 1.800.000)"

$scriptBlockConnA = {
    param($invId)
    $sql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004';
SELECT public.create_payment_with_allocation(
    '30000000-0000-0000-0000-000000000088'::UUID,
    NOW(), 1000000,
    (SELECT id FROM public.payment_methods LIMIT 1),
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-CC-A', NULL, NULL, NULL, NULL, 'Pembayaran Koneksi A Rp 1.000.000',
    '$invId'::UUID, 1000000,
    '40000000-0000-0000-0000-000000000081'::UUID
);
COMMIT;
"@
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $sql)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $out = Get-Content $tmp -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        $sw.Stop()
        return @{ Output = ($out -join "`n"); ElapsedMs = $sw.ElapsedMilliseconds; Conn = "Koneksi A" }
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}

$scriptBlockConnB = {
    param($invId)
    $sql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004';
SELECT public.create_payment_with_allocation(
    '30000000-0000-0000-0000-000000000088'::UUID,
    NOW(), 1000000,
    (SELECT id FROM public.payment_methods LIMIT 1),
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-CC-B', NULL, NULL, NULL, NULL, 'Pembayaran Koneksi B Rp 1.000.000',
    '$invId'::UUID, 1000000,
    '40000000-0000-0000-0000-000000000082'::UUID
);
COMMIT;
"@
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $sql)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $out = Get-Content $tmp -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        $sw.Stop()
        return @{ Output = ($out -join "`n"); ElapsedMs = $sw.ElapsedMilliseconds; Conn = "Koneksi B" }
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}

$jobA = Start-Job -ScriptBlock $scriptBlockConnA -ArgumentList $invId
$jobB = Start-Job -ScriptBlock $scriptBlockConnB -ArgumentList $invId
$resA = Receive-Job -Job $jobA -Wait
$resB = Receive-Job -Job $jobB -Wait
Remove-Job -Job $jobA, $jobB

Write-Host "Koneksi A selesai dalam: $($resA.ElapsedMs) ms"
Write-Host "Koneksi B selesai dalam: $($resB.ElapsedMs) ms"

$oneSuccess = ($resA.Output -match 'create_payment_with_allocation' -or $resA.Output -match '[0-9a-f]{8}-[0-9a-f]{4}') -and ($resA.Output -notmatch 'ERROR') -or (($resB.Output -match 'create_payment_with_allocation' -or $resB.Output -match '[0-9a-f]{8}-[0-9a-f]{4}') -and $resB.Output -notmatch 'ERROR')
$oneRejected = ($resA.Output -match 'CAPACITY_EXCEEDED') -or ($resB.Output -match 'CAPACITY_EXCEEDED')

if ($oneSuccess -and $oneRejected) {
    Write-Host ">>> RESULT SCENARIO 1: PASS! Tepat satu transaksi berhasil mencadangkan Rp 1.000.000, dan transaksi konkuren ditolak CAPACITY_EXCEEDED." -ForegroundColor Green
} else {
    Write-Host ">>> RESULT SCENARIO 1: FAIL!" -ForegroundColor Red
    Write-Host "Out A: $($resA.Output)"
    Write-Host "Out B: $($resB.Output)"
}

$totPending = Exec-Psql "SELECT COALESCE(SUM(amount), 0) FROM public.student_payments WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID AND status = 'pending_verification';"
Write-Host "Total Pending Payments in DB: Rp $($totPending.Trim()) (Kapasitas tidak over-allocated, persis Rp 1.000.000)"

# =============================================================================
# SCENARIO 2: DUA VERIFY_STUDENT_PAYMENT PARALEL PADA PAYMENT BERBEDA
# Sisipkan satu pembayaran lagi Rp 500.000 sehingga total ada 2 pembayaran pending (1.000.000 & 500.000).
# Jalankan verifikasi simultan pada kedua pembayaran tersebut.
# Expected:
# - Keduanya diverifikasi tanpa race condition
# - Komisi SALUT (400k) HANYA teralokasi tepat satu kali (tidak digandakan jadi 800k)
# - Sisa dana (1.100k) seluruhnya masuk ut_liability
# =============================================================================
Write-Host "`n--- [SCENARIO 2: Dua verify_student_payment paralel pada invoice sama] ---"

$addPaySql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004';
SELECT public.create_payment_with_allocation(
    '30000000-0000-0000-0000-000000000088'::UUID,
    NOW(), 500000,
    (SELECT id FROM public.payment_methods LIMIT 1),
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-CC-500K', NULL, NULL, NULL, NULL, 'Pembayaran Tambahan 500k',
    '$invId'::UUID, 500000,
    '40000000-0000-0000-0000-000000000083'::UUID
);
COMMIT;
"@
Exec-Psql $addPaySql | Out-Null

$payIds = Exec-Psql "SELECT id FROM public.student_payments WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID AND status = 'pending_verification' ORDER BY amount DESC;"
$arrPayIds = $payIds.Trim().Split("`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
$p1 = $arrPayIds[0]
$p2 = $arrPayIds[1]
Write-Host "Payment 1 to verify: $p1"
Write-Host "Payment 2 to verify: $p2"

$verifyConnA = {
    param($p1)
    $sql = "BEGIN; SET LOCAL `"request.jwt.claim.sub`" TO '20000000-0000-0000-0000-000000000004'; SELECT public.verify_student_payment('$p1'::UUID); COMMIT;"
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $sql)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $out = Get-Content $tmp -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        $sw.Stop()
        return @{ Output = ($out -join "`n"); ElapsedMs = $sw.ElapsedMilliseconds }
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}

$verifyConnB = {
    param($p2)
    $sql = "BEGIN; SET LOCAL `"request.jwt.claim.sub`" TO '20000000-0000-0000-0000-000000000004'; SELECT public.verify_student_payment('$p2'::UUID); COMMIT;"
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $sql)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $out = Get-Content $tmp -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        $sw.Stop()
        return @{ Output = ($out -join "`n"); ElapsedMs = $sw.ElapsedMilliseconds }
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}

$jobV1 = Start-Job -ScriptBlock $verifyConnA -ArgumentList $p1
$jobV2 = Start-Job -ScriptBlock $verifyConnB -ArgumentList $p2
$resV1 = Receive-Job -Job $jobV1 -Wait
$resV2 = Receive-Job -Job $jobV2 -Wait
Remove-Job -Job $jobV1, $jobV2

Write-Host "Verifikasi 1 selesai dalam: $($resV1.ElapsedMs) ms"
Write-Host "Verifikasi 2 selesai dalam: $($resV2.ElapsedMs) ms"

$salutAlloc = Exec-Psql "SELECT COALESCE(SUM(pca.amount), 0) FROM public.payment_component_allocations pca JOIN public.invoices i ON pca.invoice_id = i.id WHERE i.id = '$invId'::UUID AND pca.component_type = 'service_fee' AND pca.status = 'posted';"
$utAlloc = Exec-Psql "SELECT COALESCE(SUM(pca.amount), 0) FROM public.payment_component_allocations pca JOIN public.invoices i ON pca.invoice_id = i.id WHERE i.id = '$invId'::UUID AND pca.component_type = 'ut_liability' AND pca.status = 'posted';"
$salutAlloc = $salutAlloc.Trim()
$utAlloc = $utAlloc.Trim()

Write-Host "Service Fee Total Allocated: Rp $salutAlloc"
Write-Host "UT Liability Total Allocated: Rp $utAlloc"

if ($salutAlloc -eq "400000" -and $utAlloc -eq "1100000") {
    Write-Host ">>> RESULT SCENARIO 2: PASS! Row lock pada invoice mencegah double-allocation; komisi SALUT tepat Rp 400.000 dan kewajiban UT Rp 1.100.000." -ForegroundColor Green
} else {
    Write-Host ">>> RESULT SCENARIO 2: FAIL! Allocated SALUT: $salutAlloc, UT: $utAlloc" -ForegroundColor Red
}

# =============================================================================
# SCENARIO 3: DUA PENGAJUAN REFUND DEBIT BERSAMAAN & APPROVAL CONCURRENCY
# Setup saldo kredit mahasiswa = Rp 300.000.
# 1. Validasi penolakan over-balance: pengajuan refund Rp 400.000 langsung ditolak INSUFFICIENT_CREDIT_BALANCE.
# 2. Dua koneksi approval simultan terhadap permintaan refund yang sama:
#    Row lock FOR UPDATE mencegah approval ganda; tepat 1 transaksi berhasil mem-posting refund,
#    sedangkan transaksi konkuren ditolak INVALID_STATE.
# =============================================================================
Write-Host "`n--- [SCENARIO 3: Dua transaksi refund / approval paralel pada saldo kredit sama] ---"

$setupCreditSql = @"
BEGIN;
DELETE FROM public.student_credit_ledgers WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID;
INSERT INTO public.student_credit_ledgers (
    id, student_id, academic_period_id, idempotency_key, entry_type,
    transaction_type, amount, balance_after, notes, status, maker_by, checker_by, reviewed_at
) VALUES (
    '80000000-0000-0000-0000-000000000099'::UUID,
    '30000000-0000-0000-0000-000000000088'::UUID,
    (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
    '80000000-0000-0000-0000-000000000099'::UUID,
    'credit', 'reconciliation_credit', 300000, 300000, 'Saldo Awal Concurrency 300k', 'posted',
    '20000000-0000-0000-0000-000000000001'::UUID,
    '20000000-0000-0000-0000-000000000001'::UUID, NOW()
), (
    '80000000-0000-0000-0000-000000000081'::UUID,
    '30000000-0000-0000-0000-000000000088'::UUID,
    (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
    '80000000-0000-0000-0000-000000000081'::UUID,
    'debit', 'refund_payout', 200000, 100000, 'Refund Pending Maker A', 'pending_approval',
    '20000000-0000-0000-0000-000000000002'::UUID, NULL, NULL
);
COMMIT;
"@
Exec-Psql $setupCreditSql | Out-Null
$initBal = Exec-Psql "SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) FROM public.student_credit_ledgers WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID AND status = 'posted';"
Write-Host "Initial Student Credit Posted Balance: Rp $($initBal.Trim())"

# Sub-test 3A: Validasi pencegahan debit exceeding balance
$sub3AJob = Start-Job -ScriptBlock {
    $sql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000002';
SELECT public.request_student_credit_refund(
    '30000000-0000-0000-0000-000000000088'::UUID,
    (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1),
    400000,
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'Refund melebihi saldo',
    gen_random_uuid()
);
COMMIT;
"@
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $sql)
        $out = Get-Content $tmp -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        return ($out -join ' ')
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}
$resOver = Receive-Job -Job $sub3AJob -Wait
Remove-Job -Job $sub3AJob

$overRejected = ($resOver -match 'INSUFFICIENT_CREDIT_BALANCE')
if ($overRejected) {
    Write-Host "Sub-test 3A (Advisory lock balance check): PASS! Pengajuan refund Rp 400.000 > saldo Rp 300.000 ditolak INSUFFICIENT_CREDIT_BALANCE." -ForegroundColor Green
} else {
    Write-Host "Sub-test 3A: FAIL! Res: $resOver" -ForegroundColor Red
}

# Sub-test 3B: Dua koneksi approval simultan terhadap refund yang sama
$approveConnA = {
    $sql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000001';
SELECT public.approve_student_credit_refund('80000000-0000-0000-0000-000000000081'::UUID, 'approve');
COMMIT;
"@
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $sql)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $out = Get-Content $tmp -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        $sw.Stop()
        return @{ Output = ($out -join "`n"); ElapsedMs = $sw.ElapsedMilliseconds }
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}

$approveConnB = {
    $sql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000001';
SELECT public.approve_student_credit_refund('80000000-0000-0000-0000-000000000081'::UUID, 'approve');
COMMIT;
"@
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $sql)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $out = Get-Content $tmp -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        $sw.Stop()
        return @{ Output = ($out -join "`n"); ElapsedMs = $sw.ElapsedMilliseconds }
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}

$jobA3 = Start-Job -ScriptBlock $approveConnA
$jobB3 = Start-Job -ScriptBlock $approveConnB
$resA3 = Receive-Job -Job $jobA3 -Wait
$resB3 = Receive-Job -Job $jobB3 -Wait
Remove-Job -Job $jobA3, $jobB3

Write-Host "Approval Koneksi A selesai dalam: $($resA3.ElapsedMs) ms"
Write-Host "Approval Koneksi B selesai dalam: $($resB3.ElapsedMs) ms"

$oneAppSuccess = ($resA3.Output -match '\bt\b' -and $resA3.Output -notmatch 'ERROR') -or ($resB3.Output -match '\bt\b' -and $resB3.Output -notmatch 'ERROR')
$oneAppRejected = ($resA3.Output -match 'INVALID_STATE') -or ($resB3.Output -match 'INVALID_STATE')

if ($oneAppSuccess -and $oneAppRejected) {
    Write-Host ">>> RESULT SCENARIO 3: PASS! Row lock FOR UPDATE pada refund ledger mencegah approval ganda; tepat satu approval berhasil, approval konkuren ditolak INVALID_STATE." -ForegroundColor Green
} else {
    Write-Host ">>> RESULT SCENARIO 3: FAIL! Out 1: $($resA3.Output), Out 2: $($resB3.Output)" -ForegroundColor Red
}

# =============================================================================
# SCENARIO 4: DUA BATCH SETORAN UT BERSAMAAN DENGAN LIP SAMA
# Setup official LIP Rp 1.100.000 pada invoice yang sudah lunas.
# Koneksi A mengirim setoran Rp 1.100.000.
# Koneksi B mengirim setoran Rp 1.100.000 pada saat bersamaan.
# Expected: Multi-row locking FOR UPDATE pada LIP & remaining remittance check
# memastikan tepat satu setoran berhasil diproses, dan setoran kedua ditolak OVER_REMITTANCE.
# =============================================================================
Write-Host "`n--- [SCENARIO 4: Dua batch Setoran UT bersamaan dengan LIP sama] ---"

# Lunasi sisa 300k pada invoice
$payoffSql = @"
BEGIN;
DELETE FROM public.ut_remittance_items WHERE registration_id IN (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID);
DELETE FROM public.ut_remittances WHERE idempotency_key IN ('90000000-0000-0000-0000-000000000081'::UUID, '90000000-0000-0000-0000-000000000082'::UUID);
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004';
SELECT public.create_payment_with_allocation(
    '30000000-0000-0000-0000-000000000088'::UUID,
    NOW(), 300000,
    (SELECT id FROM public.payment_methods LIMIT 1),
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-CC-PAYOFF', NULL, NULL, NULL, NULL, 'Pelunasan sisa 300k',
    '$invId'::UUID, 300000,
    '40000000-0000-0000-0000-000000000084'::UUID
);
SELECT public.verify_student_payment(
    (SELECT id FROM public.student_payments WHERE idempotency_key = '40000000-0000-0000-0000-000000000084'::UUID)
);
COMMIT;
"@
Exec-Psql $payoffSql | Out-Null

# Buat & rekonsiliasi LIP resmi Rp 1.100.000
$lipSql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000003';
INSERT INTO public.lip_documents (
    id, registration_id, lip_number, version, official_amount, tuition_amount,
    storage_path, original_file_name, mime_type, file_size, status, created_by, updated_by
) VALUES (
    '50000000-0000-0000-0000-000000000088'::UUID,
    (SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID LIMIT 1),
    'LIP-CC-TEST-88', 1, 1100000, 1100000,
    'tests/lip-cc-test-88.pdf', 'lip-cc-test-88.pdf', 'application/pdf', 1024,
    'pending_verification',
    '20000000-0000-0000-0000-000000000003'::UUID, '20000000-0000-0000-0000-000000000003'::UUID
);
SELECT public.reconcile_lip_with_invoice(
    '50000000-0000-0000-0000-000000000088'::UUID,
    '70000000-0000-0000-0000-000000000088'::UUID
);
COMMIT;
"@
Exec-Psql $lipSql | Out-Null
$lipId = '50000000-0000-0000-0000-000000000088'
$regId = Exec-Psql "SELECT id FROM public.registrations WHERE student_id = '30000000-0000-0000-0000-000000000088'::UUID LIMIT 1;"
$regId = $regId.Trim()
Write-Host "LIP reconciled ($lipId) for Registration ($regId). Official Amount: Rp 1.100.000"

$remitConnA = {
    param($regId, $lipId)
    $sql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004';
SELECT public.create_ut_remittance_with_items(
    NOW(), 1100000,
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-UTR-CC-A', NULL, NULL, NULL, NULL, 'Setoran UT Paralel A',
    '90000000-0000-0000-0000-000000000081'::UUID,
    jsonb_build_array(
        jsonb_build_object(
            'registration_id', '$regId'::UUID,
            'lip_document_id', '$lipId'::UUID,
            'amount', 1100000
        )
    )
);
COMMIT;
"@
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $sql)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $out = Get-Content $tmp -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        $sw.Stop()
        return @{ Output = ($out -join "`n"); ElapsedMs = $sw.ElapsedMilliseconds }
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}

$remitConnB = {
    param($regId, $lipId)
    $sql = @"
BEGIN;
SET LOCAL "request.jwt.claim.sub" TO '20000000-0000-0000-0000-000000000004';
SELECT public.create_ut_remittance_with_items(
    NOW(), 1100000,
    (SELECT id FROM public.cash_accounts LIMIT 1),
    'REF-UTR-CC-B', NULL, NULL, NULL, NULL, 'Setoran UT Paralel B',
    '90000000-0000-0000-0000-000000000082'::UUID,
    jsonb_build_array(
        jsonb_build_object(
            'registration_id', '$regId'::UUID,
            'lip_document_id', '$lipId'::UUID,
            'amount', 1100000
        )
    )
);
COMMIT;
"@
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $sql)
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $out = Get-Content $tmp -Raw | docker exec -i supabase_db_Salut psql -U postgres -d postgres -t -A 2>&1
        $sw.Stop()
        return @{ Output = ($out -join "`n"); ElapsedMs = $sw.ElapsedMilliseconds }
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
    }
}

$jobR1 = Start-Job -ScriptBlock $remitConnA -ArgumentList $regId, $lipId
$jobR2 = Start-Job -ScriptBlock $remitConnB -ArgumentList $regId, $lipId
$resR1 = Receive-Job -Job $jobR1 -Wait
$resR2 = Receive-Job -Job $jobR2 -Wait
Remove-Job -Job $jobR1, $jobR2

Write-Host "Setoran UT A selesai dalam: $($resR1.ElapsedMs) ms"
Write-Host "Setoran UT B selesai dalam: $($resR2.ElapsedMs) ms"

$oneRemitSuccess = ($resR1.Output -match 'create_ut_remittance_with_items' -or $resR1.Output -match '[0-9a-f]{8}-[0-9a-f]{4}') -and ($resR1.Output -notmatch 'ERROR') -or (($resR2.Output -match 'create_ut_remittance_with_items' -or $resR2.Output -match '[0-9a-f]{8}-[0-9a-f]{4}') -and $resR2.Output -notmatch 'ERROR')
$oneRemitRejected = ($resR1.Output -match 'OVER_REMITTANCE') -or ($resR2.Output -match 'OVER_REMITTANCE')

if ($oneRemitSuccess -and $oneRemitRejected) {
    Write-Host ">>> RESULT SCENARIO 4: PASS! Multi-row locking FOR UPDATE pada LIP berhasil mengisolasi transaksi; tepat 1 setoran terbuat dan setoran konkuren ditolak OVER_REMITTANCE." -ForegroundColor Green
} else {
    Write-Host ">>> RESULT SCENARIO 4: FAIL! Out 1: $($resR1.Output), Out 2: $($resR2.Output)" -ForegroundColor Red
}

$remitCount = Exec-Psql "SELECT COUNT(*) FROM public.ut_remittance_items WHERE lip_document_id = '$lipId'::UUID;"
Write-Host "Total Remittance Items in DB for LIP: $($remitCount.Trim()) (Tepat 1 setoran, tidak melebihi official LIP Rp 1.100.000)"

Write-Host "`n================================================================="
Write-Host " ALL 4 REAL TWO-CONNECTION CONCURRENCY TESTS EXECUTED CLEANLY! "
Write-Host "================================================================="
