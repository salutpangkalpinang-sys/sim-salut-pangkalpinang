# Master Prompt Pengembangan SIM-SALUT dari Nol

Gunakan prompt berikut sebagai instruksi pertama kepada AI coding agent.

---

Anda adalah Senior Full-Stack Engineer, System Analyst, Database Architect, UI/UX Designer, dan Application Security Engineer. Bantu saya membangun aplikasi web internal bernama **SIM-SALUT Pangkalpinang** dari nol sampai siap digunakan.

Jangan langsung membuat semua fitur sekaligus. Mulai dengan memahami kebutuhan, memeriksa kondisi repository, menyusun arsitektur, lalu membangun secara bertahap. Jangan mengarang aturan bisnis yang belum dijelaskan. Jika ada keputusan yang benar-benar memengaruhi struktur database atau perhitungan keuangan, tampilkan asumsi secara jelas dan gunakan konfigurasi yang mudah diubah.

## 1. Tujuan aplikasi

SIM-SALUT adalah sistem internal untuk membantu pengelola Sentra Layanan Universitas Terbuka (SALUT) mengelola:

- Database mahasiswa dalam satu sistem, tidak lagi terpisah dalam banyak sheet Excel per angkatan.
- Data calon mahasiswa dan proses pendaftaran.
- Registrasi semester mahasiswa lama.
- Status mahasiswa: calon, aktif, cuti, nonaktif, DO, dan lulus.
- Fakultas, jenjang, program studi, skema layanan, dan tarif yang berlaku.
- LIP atau tagihan resmi UT.
- Tagihan internal mahasiswa kepada SALUT.
- Pembayaran tunai maupun transfer, termasuk pembayaran bertahap atau angsuran.
- Bukti pembayaran.
- Kewajiban pembayaran kepada UT.
- Komisi atau biaya layanan SALUT.
- Rekap piutang, pelunasan, setoran ke UT, pemasukan, pengeluaran, dan laporan.
- Riwayat perubahan data dan aktivitas pengguna.

Masalah saat ini adalah data tersebar di Excel berdasarkan angkatan, pembaruan pembayaran berawal dari catatan kertas lalu dipindahkan ke spreadsheet, sehingga rawan terlambat, terlewat, salah saldo, dan sulit dilacak.

## 2. Pengguna dan hak akses

Buat Role-Based Access Control dengan role awal berikut:

1. **Owner/Pimpinan**
   - Melihat seluruh dashboard, data, dan laporan.
   - Melihat ringkasan keuangan.
   - Mengelola pengguna dan hak akses.
   - Mengakses audit log.
   - Menyetujui pembatalan atau koreksi transaksi sensitif.

2. **Admin Akademik**
   - Mengelola data calon mahasiswa dan mahasiswa.
   - Membuat registrasi mahasiswa baru dan registrasi ulang.
   - Mengelola data prodi, skema, tahun akademik, dan LIP sesuai izin.
   - Tidak boleh menghapus transaksi pembayaran yang sudah terverifikasi.

3. **Admin Keuangan/Kasir**
   - Mencatat pembayaran mahasiswa.
   - Mengunggah bukti pembayaran.
   - Memverifikasi pembayaran.
   - Mencatat setoran atau pembayaran ke UT.
   - Mencatat pemasukan dan pengeluaran operasional.
   - Mencetak atau mengunduh bukti pembayaran.

4. **Viewer/Auditor**
   - Hanya dapat melihat data dan laporan sesuai ruang lingkupnya.
   - Tidak dapat membuat, mengubah, atau menghapus data.

Untuk MVP, aplikasi adalah aplikasi internal. Mahasiswa belum perlu memiliki akun sendiri. Namun, struktur sistem jangan menutup kemungkinan portal mahasiswa pada fase berikutnya.

## 3. Teknologi

Gunakan stack berikut kecuali repository sudah memiliki stack yang setara:

- Next.js dengan App Router.
- TypeScript strict mode.
- Tailwind CSS.
- Komponen UI yang konsisten dan accessible, boleh menggunakan shadcn/ui.
- Supabase untuk PostgreSQL, authentication, dan storage.
- Vercel untuk deployment.
- Validasi server dan client menggunakan Zod.
- Gunakan Server Actions atau API route yang aman sesuai kebutuhan.

Ketentuan teknis:

- UI berbahasa Indonesia.
- Mata uang Rupiah tanpa angka desimal.
- Zona waktu bisnis Asia/Jakarta.
- Tanggal ditampilkan dalam format Indonesia.
- Mobile responsive, tetapi penggunaan desktop admin harus menjadi prioritas.
- Jangan menaruh service-role key atau secret di browser maupun source code.
- Jangan membuat data dummy di production.
- Jangan menonaktifkan TypeScript, lint, atau security checks hanya agar build berhasil.

## 4. Prinsip data dan keuangan

Semua nominal uang disimpan sebagai integer Rupiah, bukan floating point.

Transaksi keuangan yang sudah terverifikasi tidak boleh dihapus permanen. Gunakan mekanisme void atau pembatalan dengan:

- Alasan wajib.
- Pengguna yang melakukan.
- Waktu tindakan.
- Persetujuan owner untuk transaksi sensitif.
- Jejak audit yang tidak dapat diedit oleh admin biasa.

Saldo tidak boleh disimpan sebagai angka yang diubah manual tanpa sumber. Saldo harus dapat dihitung kembali dari tagihan, pembayaran valid, pembatalan, dan penyesuaian yang tercatat.

Setiap perubahan tarif tidak boleh mengubah histori registrasi lama. Saat registrasi dibuat, simpan snapshot nama tarif, komponen, dan nominal yang berlaku saat itu.

## 5. Master data

Sediakan master data berikut:

- Tahun akademik dan semester, misalnya 2026/2027 Ganjil.
- Fakultas atau unit akademik.
- Jenjang.
- Program studi dengan kode resmi dan nama resmi.
- Skema: SIPAS dan Non-SIPAS.
- Varian layanan, misalnya Non-TTM, TTM, Semi, Penuh, Plus, atau jenis lain yang nanti dikonfigurasi.
- Jenis registrasi: mahasiswa baru dan registrasi ulang.
- Jenis biaya.
- Tarif prodi.
- Metode pembayaran.
- Kategori pemasukan dan pengeluaran.
- Status mahasiswa.

Master tarif harus mendukung:

- Tarif per semester.
- Tarif per SKS.
- Jenis biaya, misalnya uang kuliah, mata kuliah reguler, mata kuliah ulang, admisi, RPL, buku, ongkir, atau biaya akademik lain.
- Tahun akademik atau periode berlaku.
- Tanggal mulai dan berakhir.
- Status aktif/nonaktif.
- Sumber tarif.
- Status verifikasi tarif.
- Riwayat tarif tanpa menimpa data lama.

Data tarif yang tersedia saat ini mencakup SIPAS Non-TTM per semester dan beberapa tarif Non-SIPAS/per SKS. Jangan menganggap semua prodi memiliki semua skema. PGSD Pre-Service dapat mempunyai tarif Non-TTM dan TTM yang berbeda. Tarif FKIP per SKS harus dapat ditandai sebagai mata kuliah ulang jika memang demikian.

## 6. Data mahasiswa

Minimal data mahasiswa:

- ID internal.
- NIM, boleh kosong untuk calon mahasiswa.
- Nama lengkap.
- NIK, opsional sesuai keputusan bisnis dan harus diperlakukan sebagai data sensitif.
- Tempat dan tanggal lahir.
- Jenis kelamin.
- Nomor WhatsApp.
- Email.
- Alamat.
- Kabupaten/kota.
- Tahun masuk atau angkatan.
- Fakultas.
- Jenjang.
- Program studi.
- Skema layanan.
- Status mahasiswa.
- Tanggal status mulai berlaku.
- Catatan internal.
- Dokumen pendukung jika diperlukan.
- Waktu dibuat, diperbarui, dan pengguna yang melakukan perubahan.

NIM dan NIK tidak boleh duplikat jika nilainya tersedia. Sediakan pencarian cepat berdasarkan nama, NIM, NIK, dan nomor WhatsApp. Sediakan filter fakultas, prodi, angkatan, skema, dan status.

## 7. Registrasi semester dan LIP

Petugas SALUT memasukkan seluruh registrasi ke sistem, baik pendaftaran yang proses awalnya dilakukan offline di SALUT maupun proses UT yang dilakukan online oleh petugas.

Satu mahasiswa dapat memiliki banyak registrasi semester. Setiap registrasi harus menyimpan:

- Mahasiswa.
- Tahun akademik dan semester.
- Jenis registrasi.
- Prodi dan skema pada saat registrasi.
- Jumlah SKS jika relevan.
- Tarif dan komponen biaya yang di-snapshot.
- Nomor LIP.
- Biaya kuliah menurut LIP.
- Biaya buku.
- Ongkir.
- Biaya UT lain jika ada.
- Total LIP resmi.
- File foto atau PDF LIP.
- Status LIP: belum ada, draft, menunggu verifikasi, terverifikasi, dibayar ke UT, atau dibatalkan.
- Tanggal terbit dan jatuh tempo jika tersedia.
- Catatan.

Pada MVP, petugas menginput data LIP secara manual dan mengunggah foto/PDF. OCR bukan bagian wajib MVP, tetapi struktur aplikasi harus memungkinkan fitur OCR di masa depan dengan status **Dibaca Otomatis – Menunggu Verifikasi Admin**.

Total resmi UT harus mengacu pada LIP. Master tarif hanya membantu estimasi dan validasi awal. Sistem boleh memberi peringatan jika total komponen tidak sama dengan total LIP, tetapi jangan mengubah angka LIP secara diam-diam.

## 8. Tagihan internal SALUT

Gunakan rumus dasar:

**Target pembayaran mahasiswa = Total LIP resmi UT + Biaya layanan/komisi SALUT + Biaya tambahan internal yang sah - Potongan yang disetujui**

Biaya layanan SALUT saat ini menggunakan nilai awal Rp400.000 per pendaftaran/registrasi, tetapi jangan hard-code. Jadikan konfigurasi atau komponen tagihan yang dapat berubah berdasarkan periode, jenis registrasi, atau kebijakan. Snapshot nominalnya pada setiap registrasi.

Setiap tagihan memiliki:

- Nomor tagihan unik.
- Rincian komponen.
- Total tagihan.
- Total pembayaran valid.
- Sisa tagihan.
- Jatuh tempo.
- Status: draft, belum bayar, sebagian, lunas, lewat jatuh tempo, dibatalkan.
- Potongan atau penyesuaian dengan alasan dan persetujuan.

Status pembayaran harus dihitung otomatis:

- Belum bayar jika pembayaran valid = 0.
- Sebagian jika pembayaran valid lebih dari 0 tetapi kurang dari total tagihan.
- Lunas jika pembayaran valid sama dengan atau lebih dari total tagihan.
- Kelebihan bayar harus ditandai dan tidak boleh hilang.

## 9. Pembayaran mahasiswa

Satu tagihan dapat dibayar beberapa kali. Setiap pembayaran menyimpan:

- Nomor transaksi unik dan mudah dibaca.
- Tanggal dan waktu pembayaran.
- Nominal.
- Metode: tunai, transfer, atau metode lain dari master.
- Rekening atau kas tujuan jika relevan.
- Nomor referensi transfer.
- Bukti pembayaran.
- Petugas penerima/pencatat.
- Status: draft, menunggu verifikasi, terverifikasi, ditolak, atau dibatalkan.
- Catatan dan alasan penolakan/pembatalan.

Sistem harus mencegah pembayaran nol atau negatif, pembayaran duplikat yang jelas, dan perubahan nominal setelah diverifikasi tanpa alur koreksi resmi.

Setelah pembayaran terverifikasi, sediakan bukti pembayaran yang bisa dicetak atau diunduh dan memuat identitas SALUT, mahasiswa, nomor transaksi, tanggal, nominal, metode pembayaran, alokasi tagihan, sisa tagihan, dan petugas.

## 10. Pembayaran atau setoran ke UT

Pisahkan pembayaran mahasiswa kepada SALUT dari setoran SALUT kepada UT. Sistem harus dapat mencatat:

- Registrasi/LIP yang dibayar.
- Tanggal pembayaran ke UT.
- Nominal.
- Nomor referensi.
- Bukti pembayaran.
- Petugas.
- Status verifikasi.

Dashboard harus dapat membedakan:

- Uang yang telah diterima dari mahasiswa.
- Nilai kewajiban kepada UT.
- Nilai yang sudah disetor ke UT.
- Kewajiban kepada UT yang belum disetor.
- Pendapatan atau komisi SALUT.
- Piutang mahasiswa.

Jangan menyamakan seluruh uang masuk sebagai keuntungan SALUT.

## 11. Pemasukan, pengeluaran, dan laporan

Sediakan pencatatan pemasukan/pengeluaran operasional dengan kategori, tanggal, nominal, sumber/kas, bukti, deskripsi, petugas, dan status verifikasi.

Laporan minimum:

- Daftar mahasiswa per angkatan, prodi, skema, dan status.
- Registrasi per tahun akademik/semester.
- Tagihan mahasiswa.
- Piutang dan tunggakan.
- Pembayaran mahasiswa.
- Setoran ke UT.
- Kewajiban UT yang belum disetor.
- Pendapatan biaya layanan/komisi SALUT.
- Pemasukan dan pengeluaran.
- Ringkasan arus kas sederhana.
- Riwayat transaksi per mahasiswa.

Semua laporan harus memiliki filter periode dan dapat diekspor minimal ke CSV. Jangan membuat laporan laba-rugi akuntansi formal sebelum aturan akuntansinya dikonfirmasi.

## 12. Dashboard

Dashboard harus informatif dan tidak hanya dekoratif. Tampilkan minimal:

- Total mahasiswa aktif.
- Calon mahasiswa.
- Registrasi semester berjalan.
- Total tagihan.
- Total pembayaran terverifikasi.
- Piutang mahasiswa.
- Kewajiban kepada UT.
- Setoran ke UT.
- Kewajiban UT yang belum dibayar.
- Pendapatan biaya layanan SALUT.
- Pembayaran terbaru.
- Tagihan jatuh tempo atau menunggak.
- LIP yang menunggu verifikasi.

Nilai dashboard harus berasal dari query yang dapat diaudit, bukan angka dummy atau hard-code.

## 13. Struktur database minimum

Rancang skema normal yang setidaknya mencakup konsep berikut. Nama tabel boleh disesuaikan, tetapi jelaskan alasannya:

- profiles
- roles / user_roles
- academic_periods
- faculties
- study_levels
- study_programs
- service_schemes
- fee_types
- fee_rates
- students
- student_status_history
- registrations
- registration_fee_snapshots atau invoice_items
- lip_documents
- invoices
- invoice_items
- student_payments
- payment_allocations
- ut_remittances
- ut_remittance_items
- cash_accounts
- operational_transactions
- attachments
- audit_logs
- app_settings

Terapkan foreign key, unique constraint, check constraint, index, created_at, updated_at, created_by, dan updated_by sesuai kebutuhan. Gunakan soft delete hanya untuk data master atau operasional yang memang boleh dinonaktifkan. Ledger dan transaksi terverifikasi tidak boleh dihapus permanen.

## 14. Keamanan

- Aktifkan Row Level Security pada seluruh tabel yang terekspos melalui Supabase.
- Default deny; buat policy berdasarkan role dan kebutuhan nyata.
- Validasi otorisasi di server, bukan hanya menyembunyikan tombol di UI.
- Gunakan MFA untuk owner dan admin jika didukung alur yang dipilih.
- Batasi tipe dan ukuran file upload.
- Simpan bukti pembayaran dan dokumen sensitif dalam bucket private.
- Gunakan signed URL dengan masa berlaku pendek untuk melihat file.
- Jangan gunakan public bucket untuk KTP, LIP, atau bukti transfer.
- Sanitasi nama file dan jangan percaya MIME type dari browser saja.
- Catat login penting, perubahan role, perubahan tarif, verifikasi, pembatalan, dan koreksi transaksi pada audit log.
- Jangan pernah menampilkan NIK utuh pada daftar umum; masking secara default.

## 15. UI/UX

Gunakan tampilan admin yang bersih, profesional, ringan, dan mudah dipahami staf nonteknis.

Navigasi awal:

- Dashboard
- Calon Mahasiswa
- Mahasiswa
- Registrasi
- LIP & Tagihan
- Pembayaran Mahasiswa
- Setoran UT
- Kas & Operasional
- Laporan
- Master Data
- Pengguna & Hak Akses
- Audit Log
- Pengaturan

Setiap tabel utama harus mendukung pencarian, filter, sort, pagination, empty state, loading state, error state, dan konfirmasi untuk tindakan berisiko. Form panjang dibagi menjadi bagian atau langkah yang logis. Gunakan toast atau feedback yang jelas setelah tindakan.

## 16. Import data lama

Sistem nantinya harus mendukung import CSV/Excel untuk mahasiswa dan data awal. Untuk MVP fase pertama, siapkan rancangan mapping dan validasinya, tetapi jangan melakukan import otomatis tanpa preview.

Alur import yang diinginkan:

1. Upload file.
2. Pilih sheet jika diperlukan.
3. Mapping kolom file ke field sistem.
4. Preview.
5. Deteksi NIM/NIK duplikat dan data tidak valid.
6. Tampilkan baris diterima dan ditolak.
7. Konfirmasi import.
8. Simpan log hasil import.

## 17. Batas MVP fase pertama

Bangun fase pertama berikut:

1. Fondasi project dan konfigurasi environment.
2. Autentikasi.
3. Role dan permission dasar.
4. Layout dashboard dan navigasi.
5. Master periode akademik, fakultas, jenjang, prodi, skema, jenis biaya, dan tarif.
6. CRUD calon mahasiswa dan mahasiswa.
7. Riwayat status mahasiswa.
8. Registrasi semester.
9. Input dan upload LIP manual.
10. Pembuatan tagihan dan rincian komponen.
11. Pembayaran mahasiswa bertahap.
12. Verifikasi dan pembatalan transaksi yang aman.
13. Bukti pembayaran.
14. Pencatatan setoran ke UT.
15. Dashboard keuangan dasar.
16. Audit log untuk aksi penting.
17. Laporan dasar dan export CSV.

Fitur yang belum perlu dibangun pada fase pertama:

- OCR LIP otomatis.
- Portal/login mahasiswa.
- WhatsApp API.
- Payment gateway.
- Aplikasi mobile native.
- Integrasi API UT karena belum ada akses resmi.
- Laporan akuntansi formal yang belum disepakati.

## 18. Cara bekerja yang wajib diikuti

Sebelum mengubah kode:

1. Periksa repository, package manager, struktur file, dependency, dan konfigurasi yang sudah ada.
2. Ringkas pemahaman kebutuhan dan tulis asumsi penting.
3. Buat rencana implementasi bertahap.
4. Buat rancangan entity relationship dan alur status transaksi.
5. Usulkan struktur folder.
6. Identifikasi keputusan yang benar-benar menghambat implementasi.

Setelah itu, mulai implementasi fase pertama secara bertahap. Untuk setiap tahap:

- Jelaskan file yang dibuat atau diubah.
- Buat migration SQL yang aman dan dapat dijalankan ulang sesuai praktik tool yang digunakan.
- Buat seed hanya untuk master/demo, tanpa data pribadi nyata.
- Terapkan RLS dan policy bersamaan dengan tabelnya, bukan ditunda.
- Jalankan lint, type-check, test, dan production build.
- Perbaiki error sebelum menyatakan tahap selesai.
- Jangan menghapus atau menimpa perubahan yang sudah ada tanpa memeriksa diff.
- Jangan menggunakan mock data pada halaman yang diklaim sudah terhubung ke database.
- Jangan mengubah aturan bisnis tanpa menjelaskannya.
- Catat progres dan pekerjaan berikutnya dalam README atau dokumen implementasi.

## 19. Kriteria selesai fase pertama

Fase pertama dianggap selesai jika:

- Pengguna dapat login dan hanya melihat menu sesuai role.
- Admin dapat membuat dan mencari mahasiswa tanpa duplikasi NIM/NIK.
- Admin dapat membuat registrasi semester dengan snapshot tarif.
- Admin dapat menginput serta mengunggah LIP.
- Sistem dapat membuat tagihan dari LIP dan biaya layanan SALUT.
- Kasir dapat mencatat beberapa pembayaran untuk satu tagihan.
- Sisa tagihan dan status pembayaran dihitung otomatis dengan benar.
- Pembayaran dapat diverifikasi atau dibatalkan dengan audit trail.
- Setoran ke UT dicatat terpisah dari pembayaran mahasiswa.
- Dashboard membedakan penerimaan mahasiswa, kewajiban UT, setoran UT, piutang, dan pendapatan SALUT.
- Bukti pembayaran dapat dicetak/diunduh.
- File sensitif tidak dapat diakses secara publik.
- RLS mencegah akses di luar role.
- Lint, type-check, test utama, dan production build lulus.

## 20. Instruksi mulai sekarang

Jangan langsung menulis seluruh aplikasi. Mulai dengan memberikan:

1. Ringkasan pemahaman sistem.
2. Daftar asumsi yang Anda gunakan.
3. Pertanyaan yang benar-benar blocking, maksimal 7 pertanyaan.
4. Rekomendasi arsitektur.
5. Rancangan tabel dan relasi inti.
6. Urutan pembangunan fase pertama dalam checkpoint kecil.
7. Daftar environment variable yang dibutuhkan tanpa menampilkan secret.

Setelah saya menjawab pertanyaan blocking dan menyetujui rancangan, barulah implementasikan **Checkpoint 1: fondasi project, autentikasi, role, layout dashboard, dan migration master data**. Berhenti setelah Checkpoint 1 selesai, laporkan hasil pengujian, lalu tunggu persetujuan sebelum melanjutkan.

