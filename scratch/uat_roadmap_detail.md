---
pdf_options:
  format: A4
  margin: 12mm 12mm 15mm 12mm
  printBackground: true
  headerTemplate: '<div style="font-size: 8px; font-family: Helvetica, Arial, sans-serif; width: 100%; text-align: right; padding-right: 12mm; color: #64748b;">Peta Pengujian UAT Terperinci SIM-SALUT | Dokumentasi Resmi Operasional</div>'
  footerTemplate: '<div style="font-size: 8px; font-family: Helvetica, Arial, sans-serif; width: 100%; text-align: center; color: #64748b;">Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></div>'
  displayHeaderFooter: true
stylesheet:
  - https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css
css: |
  body {
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #0f172a;
  }
  .markdown-body {
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  .header-banner {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%);
    color: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .header-banner h1 {
    color: white !important;
    margin: 0 0 4px 0 !important;
    font-size: 20pt !important;
    border-bottom: none !important;
    font-weight: 800 !important;
  }
  .header-banner p {
    margin: 0 !important;
    font-size: 10.5pt !important;
    opacity: 0.95;
  }
  .badge-tag {
    display: inline-block;
    background: #3b82f6;
    color: white;
    padding: 3px 10px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 8.5pt;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  h2 {
    color: #1e3a8a !important;
    border-bottom: 2px solid #e2e8f0 !important;
    padding-bottom: 4px !important;
    font-size: 13pt !important;
    margin-top: 18px !important;
    margin-bottom: 10px !important;
  }
  h3 {
    color: #0f172a !important;
    font-size: 11pt !important;
    margin-top: 14px !important;
    margin-bottom: 6px !important;
    background: #f8fafc;
    padding: 4px 8px;
    border-left: 4px solid #2563eb;
    border-radius: 0 4px 4px 0;
  }
  ol, ul {
    padding-left: 20px !important;
    margin-top: 4px !important;
    margin-bottom: 8px !important;
  }
  li {
    margin-bottom: 3px !important;
  }
  table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin: 12px 0 !important;
    font-size: 9pt !important;
  }
  th {
    background-color: #f1f5f9 !important;
    color: #0f172a !important;
    font-weight: 700 !important;
    text-align: left !important;
    padding: 6px 10px !important;
    border: 1px solid #cbd5e1 !important;
  }
  td {
    padding: 6px 10px !important;
    border: 1px solid #e2e8f0 !important;
  }
  tr:nth-child(even) {
    background-color: #f8fafc !important;
  }
  .pass-criteria {
    background-color: #f0fdf4;
    color: #166534;
    border: 1px solid #bbf7d0;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 8.5pt;
    margin-top: 4px;
    margin-bottom: 8px;
  }
  .page-break {
    page-break-after: always;
  }
  .badge-kritis {
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 8pt;
  }
  .badge-sedang {
    background-color: #fffbebfb;
    color: #92400e;
    border: 1px solid #fef3c7;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 8pt;
  }
  .badge-kecil {
    background-color: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 8pt;
  }
---

<div class="header-banner">
  <div class="badge-tag">PETA PENGUJIAN KUALITAS SISTEM (UAT ROADMAP)</div>
  <h1>PANDUAN LANGKAH DEMI LANGKAH (STEP-BY-STEP)</h1>
  <p>Sentra Layanan Universitas Terbuka (SALUT) Mega Cendekia Pangkalpinang</p>
</div>

Dokumen ini merupakan **Panduan Pengujian Lapangan Terperinci (User Acceptance Testing / UAT)** untuk Tim SALUT Mega Cendekia Pangkalpinang. Setiap skenario dilengkapi dengan **langkah demi langkah teknis (Step-by-Step Instructions)** dan **kriteria kelulusan (Acceptance Criteria)** untuk memetakan kualitas seluruh fitur sistem.

---

## 1. Pembagian Peran Penguji (Role Access Matrix)

Sistem menggunakan kontrol akses berbasis peran (RBAC). Setiap penguji wajib login sesuai dengan peran berikut:

| Peran (Role) | Penguji Terkait | Kredensial Uji / Akses | Modul Utama yang Diuji |
| :--- | :--- | :--- | :--- |
| **Owner / Pimpinan** | Pimpinan SALUT | `admin@salut-pangkalpinang.ac.id` | Pengaturan, Pengguna, Persetujuan Void, Laporan Rekonsiliasi, Audit Log. |
| **Admin Akademik** | Tim Akademik | Role `academic_admin` | Calon Mahasiswa, Mahasiswa Aktif, Import Excel, Registrasi Semester, Verifikasi LIP. |
| **Admin Keuangan** | Tim Keuangan / Kasir | Role `finance_admin` | Pembayaran Mahasiswa, Alokasi Tagihan, Cetak Kuitansi, Setoran UT, Kas Operasional. |
| **Viewer / Auditor** | Staf Audit / Monitoring | Role `viewer` | Pemantauan Dashboard, Laporan Keuangan Read-Only, Pengecekan Audit Log. |

---

## 2. Peta Alur Pengujian Terperinci (7 Modul Skenario)

---

### Skenario 1: Akses Sistem & Hak Akses Pengguna (RBAC)

#### **Skenario 1.1: Pemosisian Peran & Pembatasan Fitur**
1. Buka browser dan akses halaman utama aplikasi `/login`.
2. Masukkan email Owner `admin@salut-pangkalpinang.ac.id` dan password `suksesterus`. Klik **Masuk**.
3. Periksa menu navigasi di sebelah kiri. Seluruh modul (Dashboard, Calon Mahasiswa, Mahasiswa, Registrasi, LIP & Tagihan, Pembayaran Mahasiswa, Setoran UT, Kas Operasional, Laporan, Master Data, Pengguna & Hak Akses, Audit Log, Pengaturan) harus tampil lengkap.
4. Beralih ke peran **Admin Akademik** atau **Admin Keuangan**.
5. Coba akses menu **Pengaturan** atau **Pengguna & Hak Akses**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Pengguna non-Owner dilarang mengubah Pengaturan atau Pengguna. Tombol mutasi finansial tertutup bagi akun Viewer.</div>

#### **Skenario 1.2: Pembuatan Pengguna Baru SALUT**
1. Login sebagai Owner, buka menu `/pengguna`.
2. Klik tombol `+ Tambah Pengguna`.
3. Masukkan **Nama Lengkap**: `Ahmad Kasir`, **Username**: `ahmad`, **Role**: `Admin Keuangan / Kasir`, dan **Password**.
4. Klik **Simpan Pengguna**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Sistem otomatis menambahkan domain <code>@salut-pangkalpinang.ac.id</code> jika hanya memasukkan username. Pengguna baru berhasil terbuat dan dapat digunakan untuk login.</div>

---

### Skenario 2: Modul Akademik — Pendataan & Import Mahasiswa

#### **Skenario 2.1: Entry Data Calon Mahasiswa Baru (`/calon-mahasiswa`)**
1. Login sebagai Admin Akademik, buka menu `/calon-mahasiswa`.
2. Klik tombol `+ Tambah Calon Mahasiswa`.
3. Isi data berikut:
   - **Nama Lengkap**: `Rudi Pratama`
   - **NIK**: `1902011205980001` (16 Digit)
   - **No. WhatsApp**: `081271665544`
   - **Program Studi**: *Sistem Informasi (S1)*
   - **Skema Layanan**: *SIPAS Non-TTM*
   - **Tahun Angkatan**: *20261*
4. Uji kasus kesalahan: Coba ubah NIK menjadi `12345` (5 digit) lalu klik simpan.
5. Kembalikan NIK menjadi 16 digit valid, lalu klik **Simpan**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Sistem menampilkan pesan error jika NIK &lt; 16 digit. Data valid berhasil tersimpan di tabel Calon Mahasiswa tanpa NIM (NIM Kosong).</div>

#### **Skenario 2.2: Penetapan NIM & Konversi ke Mahasiswa Aktif (`/mahasiswa`)**
1. Pada halaman `/calon-mahasiswa`, cari nama `Rudi Pratama`.
2. Klik tombol `Aksi` $\rightarrow$ `Penerbitan NIM / Ubah Status`.
3. Masukkan **NIM Resmi UT**: `053099881` (9 digit).
4. Klik **Simpan Penetapan NIM**.
5. Buka menu `/mahasiswa` (Database Mahasiswa).
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Data mahasiswa <code>Rudi Pratama</code> otomatis berpindah dari daftar Calon Mahasiswa ke daftar Mahasiswa Aktif secara real-time.</div>

<div class="page-break"></div>

#### **Skenario 2.3: Import Data Massal via Excel/CSV (`/mahasiswa`)**
1. Buka menu `/mahasiswa`, lalu klik tombol `Import Excel/CSV`.
2. Unduh **Template CSV/XLSX** resmi yang disediakan sistem.
3. Buka file template dan isi 5 baris data dummy mahasiswa baru. Pastikan nomor NIK dan WhatsApp diawali angka `0` (contoh: `081987654321` dan NIK `0901...`).
4. Unggah file tersebut kembali ke modal import. Klik **Proses Import**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Berkas terproses tanpa error format. Angka <code>0</code> di awal NIK dan No. WhatsApp tidak terpotong atau hilang pada tabel database.</div>

---

### Skenario 3: Modul Registrasi Semester & Tagihan LIP

#### **Skenario 3.1: Pembuatan Registrasi Semester & Autokalkulasi Tarif (`/registrasi`)**
1. Buka menu `/registrasi`, klik `+ Registrasi Semester Baru`.
2. Pilih Mahasiswa Aktif: `Rudi Pratama` (*Prodi: Sistem Informasi*).
3. Pilih **Periode Akademik**: `20261`, **Tipe Registrasi**: `Registrasi Pertama (Maba)`.
4. Pilih **Skema Layanan**: `SIPAS Non-TTM`.
5. Amati kolom Tarif yang direkomendasikan sistem.
6. Klik **Simpan Registrasi**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Sistem otomatis menerapkan tarif spesifik Prodi Sistem Informasi (Rp 1.800.000 untuk SIPAS Non-TTM) sesuai Brosur Resmi UT Owner, serta menerbitkan Snapshot Tarif & Dokumen LIP.</div>

#### **Skenario 3.2: Verifikasi Dokumen LIP & Tagihan (`/lip-tagihan`)**
1. Buka menu `/lip-tagihan`.
2. Cari dokumen tagihan atas nama `Rudi Pratama` (Status Awal: `Draft`).
3. Klik `Lihat Rincian / Verifikasi`.
4. Masukkan Nomor LIP resmi dari UT: `LIP20261009988`.
5. Klik **Verifikasi Dokumen LIP**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Status Dokumen LIP berubah dari <code>Draft</code> menjadi <code>Verified</code>. Tagihan resmi aktif dan siap diajukan pembayaran.</div>

---

### Skenario 4: Modul Keuangan — Pembayaran & Kuitansi Resmi

#### **Skenario 4.1: Input Pembayaran & Alokasi Tagihan (`/pembayaran`)**
1. Login sebagai Admin Keuangan, buka menu `/pembayaran`.
2. Klik `+ Input Pembayaran Mahasiswa`.
3. Pilih Mahasiswa: `Rudi Pratama`.
4. Isi rincian: **Tanggal Bayar**: Hari ini, **Metode Bayar**: *Transfer Bank*, **Akun Kas Penerima**: *Bank Mandiri SALUT*, **Nominal Bayar**: `Rp 2.050.000` (terdiri dari LIP UT Rp 1.800.000 + Biaya Layanan SALUT Rp 250.000).
5. Unggah berkas Bukti Transfer (Format JPG/PNG/PDF).
6. Centang dan alokasikan pembayaran ke Dokumen LIP `LIP20261009988`.
7. Klik **Simpan & Verifikasi Pembayaran**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Pembayaran tersimpan dengan status <code>Verified</code>, saldo Kas Bank Mandiri bertambah, dan sisa tagihan mahasiswa menjadi Rp 0 (Lunas).</div>

#### **Skenario 4.2: Cetak Kuitansi Resmi SALUT (`/pembayaran`)**
1. Pada tabel pembayaran `/pembayaran`, cari transaksi `Rudi Pratama` yang baru diverifikasi.
2. Klik tombol `Cetak Kuitansi`.
3. Periksa tampilan Modal Kuitansi:
   - Nomor Kuitansi unik (contoh: `KW/2026/08/0001`)
   - Teks Terbilang Rupiah: *"Dua Juta Lima Puluh Ribu Rupiah"*
   - Rincian Alokasi (LIP UT & Service Fee SALUT)
4. Klik **Cetak PDF**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Berkas PDF Kuitansi terunduh dengan tata letak rapi, logo SALUT presisi, dan siap dibagikan ke mahasiswa.</div>

#### **Skenario 4.3: Pengajuan Pembatalan Pembayaran / Void Request (`/pembayaran`)**
1. Pilih salah satu transaksi pembayaran yang salah input.
2. Klik `Aksi` $\rightarrow$ `Pengajuan Pembatalan (Void)`.
3. Masukkan **Alasan Pembatalan**: *Salah mendaftarkan ke akun kas tunai*.
4. Klik **Kirim Pengajuan Void**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Status transaksi berubah menjadi <code>Pending Void</code>. Tombol cetak kuitansi otomatis terkunci, dan transaksi menunggu persetujuan Owner.</div>

<div class="page-break"></div>

---

### Skenario 5: Modul Remitansi Setoran UT

#### **Skenario 5.1: Buat Berkas Setoran UT (`/setoran-ut`)**
1. Buka menu `/setoran-ut`, klik `+ Buat Rekap Setoran UT`.
2. Masukkan **Tanggal Setor**, pilih **Akun Kas Sumber**: *Bank Mandiri SALUT*.
3. Pilih dokumen LIP mahasiswa yang sudah lunas terbayar.
4. Periksa jumlah total setoran.
5. Klik **Simpan Berkas Setoran**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Total setoran murni sebesar tagihan resmi UT (Rp 1.800.000), tanpa mencampur Biaya Layanan Internal SALUT (Rp 250.000).</div>

#### **Skenario 5.2: Pelunasan & Verifikasi Setoran UT**
1. Pada daftar setoran UT, klik `Verifikasi / Unggah Bukti Bayar UT`.
2. Unggah bukti transfer ke Rekening Resmi UT dan masukkan Nomor Referensi Bank.
3. Klik **Konfirmasi Setoran Terverifikasi**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Status setoran berubah menjadi <code>Verified</code>. Total Liabilitas Kewajiban UT pada dashboard otomatis terkurangi secara presisi.</div>

---

### Skenario 6: Modul Kas Operasional Internal SALUT

#### **Skenario 6.1: Pencatatan Pemasukan / Pengeluaran Rutin (`/kas-operasional`)**
1. Buka menu `/kas-operasional`, klik `+ Transaksi Operasional`.
2. Isi formulir:
   - **Jenis Transaksi**: *Pengeluaran*
   - **Kategori**: *Beban Listrik & Internet*
   - **Akun Kas**: *Kas Kecil / Bank*
   - **Nominal**: `Rp 750.000`
   - **Keterangan**: *Pembayaran Listrik Kantor Bulan Agustus 2026*
3. Unggah Struk / Nota Pembayaran.
4. Klik **Simpan Transaksi**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Transaksi tercatat, bukti nota terunduh/terlihat di preview, dan Saldo Kas Operasional terpotong Rp 750.000.</div>

---

### Skenario 7: Pengawasan Pimpinan, Laporan & Audit Log

#### **Skenario 7.1: Persetujuan Pembatalan Transaksi oleh Owner**
1. Login kembali sebagai **Owner** (`admin@salut-pangkalpinang.ac.id`).
2. Buka menu `/pembayaran`, filter status `Pending Void`.
3. Buka rincian pengajuan void dari Admin Keuangan pada Skenario 4.3.
4. Klik tombol **Setujui Pembatalan (Approve Void)**.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Hanya akun Owner yang memiliki akses menyetujui void. Setelah disetujui, tagihan kembali ke status belum terbayar dan saldo kas terkoreksi otomatis.</div>

#### **Skenario 7.2: Pemantauan Laporan Keuangan & Rekonsiliasi (`/laporan`)**
1. Login sebagai Owner / Viewer, buka menu `/laporan`.
2. Tentukan **Rentang Tanggal Pengujian** (misal: Bulan Ini).
3. Periksa Kartu KPI Ringkasan:
   - Total Penerimaan Kas Mahasiswa
   - Total Setoran Remitansi UT
   - Pergerakan Kas Net (Net Cash Movement)
   - Piutang Mahasiswa (Student Receivable)
   - Liabilitas Setoran UT (UT Liability)
4. Klik **Export Excel / CSV**. Buka file hasil unduhan.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Laporan menggunakan istilah akuntansi perbankan resmi tanpa istilah "Laba/Rugi", dan file CSV terbebas dari ancaman formula injection.</div>

#### **Skenario 7.3: Inspeksi Audit Log Global (`/audit-log`)**
1. Buka menu `/audit-log`.
2. Gunakan kolom pencarian untuk mencari nama pengguna `ahmad` atau modul `pembayaran`.
3. Periksa timestamp waktu kejadian.
<div class="pass-criteria"><b>✓ Kriteria Kelulusan:</b> Waktu aktivitas tercetak tepat dalam format WIB (Asia/Jakarta), dan seluruh nomor NIK mahasiswa tersamar demi privasi (contoh: <code>1902**********0001</code>).</div>

---

<div class="page-break"></div>

## 3. Form Pelaporan Kendala / Bug (Issue Reporting Log)

Jika Tim Penguji SALUT menemukan kendala atau ketidaksesuaian saat menguji skenario di atas, mohon dapat mencatatnya pada formulir berikut:

| No | Modul / Halaman | Skenario Pengujian | Deskripsi Masalah (Ekspektasi vs Realita) | Tingkat Kendala | Tangkapan Layar / Catatan |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | *Contoh: /pembayaran* | *4.2 Cetak Kuitansi* | *Ekspektasi: Kuitansi terbuka. Realita: Tombol cetak tidak merespon.* | <span class="badge-sedang">SEDANG</span> | *kuitansi_error.png* |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |

---

> **Panduan Klasifikasi Tingkat Kendala**:
> - <span class="badge-kritis">KRITIS (BLOCKER)</span>: Error fatal / crash yang membuat alur pekerjaan terhenti total dan tidak dapat dilanjutkan.
> - <span class="badge-sedang">SEDANG (MAJOR)</span>: Fitur dapat diakses tetapi hasil kalkulasi, format data, atau alurnya kurang sesuai.
> - <span class="badge-kecil">KECIL (MINOR/UX)</span>: Masalah kerapian tampilan, kejelasan kata, atau saran kemudahan penggunaan.

---

<div style="margin-top: 30px; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; background-color: #f8fafc;">
  <b>Kontak Bantuan & Penanganan Teknis:</b><br/>
  • <b>Tim Pengembang / Support</b>: Pengembang Sistem SIM-SALUT<br/>
  • <b>Kredensial Owner Uji</b>: <code>admin@salut-pangkalpinang.ac.id</code> (Password: <code>suksesterus</code>)<br/>
  • <b>Status Database Produksi</b>: Siap Digunakan (Clean Database)
</div>

<div style="margin-top: 20px; text-align: center; font-size: 8.5pt; color: #64748b;">
  <b>SIM-SALUT Mega Cendekia Pangkalpinang v1.0</b><br/>
  <i>Dokumen Peta Pengujian Terperinci UAT — Hak Cipta © 2026 SALUT Mega Cendekia</i>
</div>
