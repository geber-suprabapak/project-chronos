# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pengguna utama adalah administrator sekolah yang mengelola data operasional harian. Guru dan staf mendapat akses terbatas sesuai peran; siswa tidak menggunakan Chronos. Antarmuka harus tetap dapat dipakai pada desktop, tablet, dan ponsel.

## Product Purpose

Skanida Chronos adalah portal administrasi sekolah untuk memantau dan mengelola profil, data siswa, absensi, perizinan, lokasi, jadwal, serta ekspor operasional. Produk berhasil ketika admin dapat menyelesaikan alur tersebut secara akurat, dapat ditelusuri, dan konsisten dengan data serta otorisasi Astra tanpa pekerjaan manual yang tersembunyi.

## Positioning

Chronos adalah permukaan kerja administratif dari ekosistem Skanida: Logto menetapkan identitas dan peran, sedangkan Astra menjadi otoritas API dan state domain. Chronos tidak memiliki database domain sendiri.

## Operating Context

- Admin bekerja dengan daftar dan detail siswa/staf, catatan kehadiran, permohonan izin, lokasi sekolah, serta jadwal.
- Ekspor dan backup dipakai sebagai artefak operasional; pembuatan data ekspor harus terjadi di server agar tidak bergantung pada baris yang sedang terlihat di browser.
- Pengujian write-path dilakukan terhadap lingkungan lokal/mock. Pemeriksaan produksi selama settlement bersifat read-only.
- Integrasi Chronos–Astra memakai kontrak versi `v1` dan token resource Logto.

## Capabilities and Constraints

- Area utama saat ini: dashboard, profiles, data siswa, absensi umum/per kelas, perizinan, konfigurasi lokasi, dan konfigurasi jadwal.
- Navigasi yang tidak diizinkan harus disembunyikan, tetapi otorisasi server tetap menjadi batas keamanan yang wajib.
- Bahasa kanonis antarmuka adalah Bahasa Indonesia.
- Geocoding harus melalui proxy internal dengan cache; klien tidak boleh bergantung langsung pada layanan geocoding publik.
- Peningkatan dependency ditargetkan sebagai satu program settlement dengan checkpoint internal dan urutan kompatibilitas lintas repo.
- `/profiles` adalah direktori akun admin untuk seluruh identitas, sedangkan `/siswa` adalah roster operasional siswa untuk peran privileged; batas ini ditetapkan dalam ADR-001.
- Taksonomi absensi memisahkan event `check_in`/`check_out` dari status harian kanonis sesuai ADR-002.

## Brand Commitments

- Nama produk: **Skanida Chronos**.
- Arah produk adalah memoles antarmuka incumbent, bukan menggantinya dengan redesign yang tidak berhubungan.
- Copy harus menggunakan istilah Bahasa Indonesia yang konsisten; istilah teknis internal tidak boleh bocor ke tugas admin tanpa kebutuhan.

## Evidence on Hand

- Implementasi UI dan rute: `src/app/` dan `src/components/`.
- Batas akses: `src/server/api/trpc.ts`, `src/server/auth/`, dan `docs/rbac-implementation.md`.
- Kontrak lokal Astra: `contracts/astra-v1.json`.
- Pengujian lokal: `tests/`, `e2e/`, dan fixture Astra/Logto di `e2e/fixtures/`.
- Logo produk tersedia sebagai `public/logo.png`.
- Tidak ada riset pengguna, analitik penggunaan, atau bukti usability lapangan yang tervalidasi di repository; pekerjaan berikutnya tidak boleh mengarangnya.

## Product Principles

1. **Akurat sebelum cepat.** Daftar, ringkasan, ekspor, dan backup harus mewakili dataset lengkap yang dimaksud pengguna.
2. **Otoritas eksplisit.** Logto memiliki identitas/peran; Astra memiliki state domain; Chronos mengorkestrasi pengalaman admin tanpa membuat sumber kebenaran baru.
3. **Hak akses berlapis.** UI membantu dengan menyembunyikan aksi terlarang, sedangkan server selalu memverifikasi otorisasi.
4. **Operasional yang dapat dipulihkan.** Kegagalan jaringan, ekspor, upload, dan mutasi harus terlihat, dapat dicoba ulang dengan aman, serta tidak memberi kesan sukses palsu.
5. **Settlement sebelum ekspansi.** Fitur baru menunggu sampai P0/P1 ditutup, kontrak sinkron, test gate hijau, smoke produksi selesai, dan dokumentasi kembali sesuai realitas.

## Accessibility & Inclusion

Target minimum adalah WCAG 2.2 level AA pada alur yang didukung, termasuk navigasi keyboard, nama/role/state yang dapat dikenali assistive technology, fokus yang terlihat, kontras, reflow, serta target sentuh yang memadai.
