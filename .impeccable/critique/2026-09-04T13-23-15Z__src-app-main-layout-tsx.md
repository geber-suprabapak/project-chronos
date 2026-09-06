---
target: Skanida Chronos application shell
total_score: 21
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 4
target_identity: "file:/home/robin/project/project-chronos/src/app/(main)/layout.tsx"
target_fingerprint: "sha256:167b45022e5e9492aad78c95e573e13b8d797d7f0db5fc771a6c3a8ee3dac634"
target_path: /home/robin/project/project-chronos/src/app/(main)/layout.tsx
timestamp: 2026-09-04T13-23-15Z
slug: src-app-main-layout-tsx
---
# UI critique — Skanida Chronos

Method: dual-agent Impeccable critique. Assessment A menilai render lebih dulu; Assessment B kemudian menjalankan detector dan browser/axe tanpa melihat hasil A. Target: `src/app/(main)/layout.tsx`; slug: `src-app-main-layout-tsx`.

| Heuristik usability | Skor | Bukti |
| --- | ---: | --- |
| Visibility of system status | 3/4 | Toast/loading ada, tetapi beberapa kegagalan Astra berubah menjadi empty state |
| Match with real world | 2/4 | UUID, koordinat GPS, “Logto”, dan istilah Inggris bocor ke pekerjaan admin |
| User control & freedom | 2/4 | Native confirm, full-page nav, dan status backup localStorage membuat recovery/intent tidak jelas |
| Consistency & standards | 2/4 | Merah dipakai untuk PDF; CTA/status memakai warna tanpa hierarchy konsisten |
| Error prevention | 2/4 | “Selesai” dapat menandai backup tanpa artefak; aksi mobile dapat terdorong keluar viewport |
| Recognition over recall | 2/4 | Legend tablet terpotong dan kolom aksi mobile tersembunyi di luar layar |
| Flexibility & efficiency | 2/4 | Tabel 665–1.006px tidak usable pada 390px; pagination ganda menambah beban |
| Aesthetic/minimalist design | 3/4 | Surface tenang dan elevation baik, tetapi title ganda serta raw IDs menambah noise |
| Error recovery | 2/4 | Empty, unavailable, forbidden, dan contract failure belum dibedakan konsisten |
| Help/documentation | 1/4 | Makna “backup”, batas role, dan perbedaan Profiles/Siswa tidak dijelaskan |
| **Total** | **21/40** | Belum layak dianggap polished/settled |

## Design-specificity verdict

Fondasi Shadcn/Tailwind cukup koheren dan tenang, tetapi identitas produk masih generik. Detail perizinan, drawer mobile, border/radius, dan modal layak dipertahankan; diferensiasi sebaiknya datang dari hierarchy operasional, Bahasa Indonesia, dan model data sekolah—bukan dekorasi baru.

## Priority issues

1. **P1 — Mobile data/actions tidak dapat dijangkau.** Pada 390px, tabel Absensi, Siswa, Profiles, Lokasi, dan Jadwal tetap selebar 665–1.006px; kolom status/edit/hapus/detail keluar viewport.
2. **P1 — Export salah secara makna dan representasi.** PDF membaca DOM/page slice dan diberi warna destructive; “backup” dapat ditandai selesai di localStorage tanpa backup authoritative.
3. **P1 — Accessibility names dan contrast gagal.** Axe mengonfirmasi unnamed combobox, date input, 9 switch, dan tombol close; success button 2,78:1 dan badge 3,41–3,94:1.
4. **P1 — Bahasa dan domain tidak koheren.** `lang="en"`, Profiles berbahasa Inggris, status Approve/Reject/Pending, serta “Chronos Alpha”/“Logto” muncul ke admin.
5. **P2 — Hierarchy/polish menghambat scan.** Toolbar title mengulang H1, legend KPI terpotong pada tablet, UUID/GPS mentah dominan, dan target sentuh banyak di bawah 44×44px.

## Persona red flags

- Warna merah pada download menyerupai hapus.
- Data terpenting tersembunyi di mobile.
- Label statistik harus ditebak.
- Role yang berbeda melihat navigasi sama.
- Laporan yang tampak sukses belum tentu lengkap.

## Minor observations

Theme switch tersedia di menu user dan dark mode berhasil diuji; dark mode membuka contrast badge tambahan. Static detector berjalan dalam mode degraded karena parser HTML/CSS tidak terpasang; tiga temuan root berasal dari asset Playwright trace dan ditolak sebagai false positive. Bukti runtime browser/axe dipakai sebagai sumber utama.
