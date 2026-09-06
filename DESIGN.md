---
name: "Skanida Chronos"
description: "A calm, precise operations desk for school administration."
colors:
  canvas: "oklch(1 0 0)"
  ink: "oklch(0.145 0 0)"
  surface: "oklch(1 0 0)"
  action: "oklch(0.205 0 0)"
  action-contrast: "oklch(0.985 0 0)"
  quiet-surface: "oklch(0.97 0 0)"
  quiet-ink: "oklch(0.556 0 0)"
  divider: "oklch(0.922 0 0)"
  focus: "oklch(0.708 0 0)"
  danger: "oklch(0.577 0.245 27.325)"
  success: "oklch(0.6 0.18 152)"
  info: "oklch(0.6 0.18 240)"
  warning: "oklch(0.75 0.18 85)"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-contrast}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-secondary:
    backgroundColor: "{colors.quiet-surface}"
    textColor: "{colors.action}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.action-contrast}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  input-default:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
---

# Design System: Skanida Chronos

## Overview

**Creative North Star: "The Calm Operations Desk"**

Skanida Chronos terasa seperti meja kerja operasional yang profesional, tenang, dan dapat dipercaya. Informasi boleh padat dan rinci, tetapi hierarchy, alignment, spacing, serta bahasa yang konsisten harus membuat layar tetap mudah dipindai oleh admin sekolah yang bekerja cepat sepanjang hari.

Sistem ini mengutamakan usability di atas dekorasi. Karakter visual datang dari proporsi yang rapi, state yang tegas, warna status yang terukur, dan interaksi yang responsif—bukan gradient dekoratif, shadow berat, atau animasi yang menarik perhatian dari tugas. Pola shadcn/ui adalah fondasi; penyempurnaan harus memperkuat konsistensi dan aksesibilitas tanpa mengubahnya menjadi redesign yang tidak berhubungan.

**Key Characteristics:**

- Professional, calm, and operational.
- Data-dense yet easy to scan.
- Friendly through clear language, forgiving states, and predictable behavior.
- Fast for repetitive work, with frequent actions close to their context.
- Restrained and accessible rather than visually theatrical.

## Colors

Palet netral berkontras tinggi menjaga data sebagai fokus, sementara warna semantik dipakai secara hemat untuk status, feedback, dan risiko.

### Primary

- **Operational Ink**: warna aksi utama dan navigasi aktif; bobot gelapnya memberi ketegasan tanpa memperkenalkan warna brand dekoratif.

### Secondary

- **Quiet Utility**: permukaan sekunder untuk hover, pilihan aktif, filter, dan kontrol pendamping yang tidak boleh bersaing dengan aksi utama.

### Tertiary

- **Clear Information**, **Confirmed Success**, **Caution Amber**, dan **Critical Red**: warna semantik untuk informasi, hasil berhasil, peringatan, dan tindakan atau kondisi berbahaya. Selalu pasangkan warna dengan label atau ikon; warna tidak boleh menjadi satu-satunya pembeda.

### Neutral

- **Clear Canvas**: latar utama yang menjaga tabel dan formulir terasa terang serta terbaca.
- **Structured Surface**: bidang card, popover, dialog, dan area kerja terkelompok.
- **Primary Ink**: teks utama dan nilai data dengan kontras tertinggi.
- **Supporting Ink**: metadata, placeholder, dan penjelasan sekunder; tidak untuk informasi penting.
- **Quiet Divider**: border dan pemisah struktur yang terlihat tanpa mendominasi.
- **Visible Focus**: dasar focus ring yang harus tetap terbaca pada tema terang dan gelap.

### Named Rules

**The Meaning Before Color Rule.** Setiap status dan hasil aksi harus tetap dapat dipahami tanpa persepsi warna.

**The Signal Budget Rule.** Gunakan warna semantik hanya ketika ia menyampaikan status, feedback, atau risiko; jangan memakainya sebagai dekorasi permukaan besar.

## Typography

**Display Font:** Geist (dengan fallback ui-sans-serif dan system-ui)
**Body Font:** Geist (dengan fallback ui-sans-serif dan system-ui)
**Label Font:** Geist (dengan fallback ui-sans-serif dan system-ui)

**Character:** Geist membuat antarmuka terasa modern, netral, dan efisien. Perbedaan ukuran, weight, dan spacing—bukan pergantian font—membentuk hierarchy yang stabil pada dashboard padat data.

### Hierarchy

- **Headline** (700, 1.875rem, 1.2): judul halaman tingkat atas pada ruang yang memadai; turunkan secara responsif ketika viewport sempit.
- **Title** (600, 1.25rem, 1.4): judul halaman kompak, card, dialog, atau kelompok data.
- **Body** (400, 0.875rem, 1.5): isi tabel, formulir, metadata utama, dan copy operasional.
- **Label** (500, 0.75rem, 1.4): label ringkas, badge, dan metadata pendamping; gunakan sentence case.

### Named Rules

**The One Typeface Rule.** Gunakan Geist untuk seluruh antarmuka operasional; hierarchy harus berasal dari ukuran, weight, dan susunan, bukan campuran typeface dekoratif.

**The Data Legibility Rule.** Jangan mengecilkan teks inti untuk memaksakan lebih banyak kolom; gunakan reflow, progressive disclosure, atau scroll container yang jelas.

## Layout

Shell menggunakan sidebar responsif selebar 16rem pada desktop, mode ikon selebar 3rem, dan sheet selebar 18rem pada perangkat kecil. Toolbar utama setinggi 3rem menjaga navigasi tetap ringkas. Konten menggunakan ritme berbasis 0.25rem dengan jarak berulang 0.5rem, 0.75rem, 1rem, dan 1.5rem; container lebar memakai batas 80rem saat kebutuhan data mengizinkan.

Layar operasional mengikuti urutan judul dan konteks, ringkasan, filter atau quick actions, lalu data utama. Aksi yang sering dipakai harus dekat dengan baris atau objeknya dan dapat dicapai tanpa perjalanan pointer yang panjang. Pada layar sempit, kontrol reflow menjadi satu kolom atau kelompok yang dapat dibungkus; tabel boleh scroll horizontal hanya jika konteks kolom dan affordance scroll tetap jelas.

Breakpoint incumbent adalah small 40rem, medium 48rem, dan large 64rem. Desain harus mendukung reflow hingga 320 CSS pixel, target sentuh minimum 44×44 CSS pixel untuk kontrol sentuh utama, dan pembesaran teks tanpa memotong aksi atau data penting.

**The Repetition Wins Rule.** Optimalkan alur yang dilakukan berulang kali: urutan fokus, lokasi aksi, filter persisten, dan feedback harus dapat diprediksi dari satu layar ke layar berikutnya.

## Elevation & Depth

Sistem memakai model hybrid yang flat-by-default. Border tipis dan perbedaan tonal membentuk struktur utama; shadow kecil membuat tombol, input, dan card tetap terbaca tanpa terasa mengambang. Shadow menengah dan besar hanya menandai lapisan yang benar-benar berada di atas halaman, seperti dropdown, popover, sheet, dan dialog. Focus ring adalah indikator interaksi, bukan efek dekoratif, dan tidak boleh digantikan oleh shadow.

### Shadow Vocabulary

- **Control Lift** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): penegasan halus pada tombol dan input di atas canvas.
- **Surface Lift** (`0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): card atau surface yang membutuhkan pemisahan ringan.
- **Floating Layer** (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): menu dan popover.
- **Modal Layer** (`0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): dialog atau lapisan modal.

### Named Rules

**The Subtle but Visible Rule.** Depth harus membantu pengguna membedakan lapisan dan state dalam sekali lihat, tetapi tidak boleh menjadi elemen visual yang paling menonjol.

**The Real Layers Only Rule.** Shadow menengah atau besar hanya untuk elemen yang secara perilaku berada di atas konten lain.

## Shapes

Sudut membulat lembut menjaga tampilan ramah tanpa terasa playful: kontrol memakai radius 0.5rem, surface umum 0.625rem, dan card utama 0.875rem. Border tipis adalah bagian dari bahasa struktur. Pill penuh dibatasi untuk avatar, indikator, atau status yang memang membutuhkan silhouette tersebut; bukan default untuk semua tombol dan card.

## Components

Komponen harus terasa refined and restrained: cukup responsif untuk meyakinkan, cukup tenang untuk dipakai berulang kali.

### Buttons

- **Shape:** sudut membulat lembut dengan tinggi default 2.25rem; pada konteks sentuh, perluas hit area hingga sedikitnya 44×44 CSS pixel tanpa harus memperbesar visualnya secara berlebihan.
- **Primary:** Operational Ink di atas teks kontras tinggi, dipakai untuk satu tindakan utama dalam satu konteks.
- **Hover / Focus / Active:** hover mengubah tonal secara halus; focus-visible memakai ring 3px yang jelas; active memberi feedback langsung tanpa pergeseran layout.
- **Secondary / Outline / Ghost:** gunakan untuk aksi pendamping berdasarkan tingkat kepentingannya. Destructive selalu berlabel eksplisit dan tidak boleh disamarkan sebagai aksi netral.

### Chips

- **Style:** badge ringkas dengan radius sedang, label pendek, dan pasangan warna semantik yang terbaca.
- **State:** selected dan status harus berbeda melalui label, ikon, border, atau weight selain warna.

### Cards / Containers

- **Corner Style:** radius 0.875rem untuk card utama dan radius lebih kecil untuk kelompok internal.
- **Background:** Structured Surface di atas Clear Canvas.
- **Shadow Strategy:** Surface Lift adalah batas normal; gunakan border dan spacing sebagai pemisah pertama.
- **Border:** satu pixel Quiet Divider ketika batas membantu scanning atau pengelompokan.
- **Internal Padding:** 1.5rem pada desktop, dapat menjadi lebih rapat secara responsif tanpa menekan target interaksi.

### Inputs / Fields

- **Style:** tinggi default 2.25rem, border jelas, radius 0.5rem, dan latar transparan atau surface sesuai konteks.
- **Focus:** border beralih ke Visible Focus dan ring 3px muncul di luar kontrol; state tidak boleh mengubah ukuran elemen.
- **Error / Disabled:** error memakai label yang menjelaskan perbaikan serta warna Critical Red; disabled terlihat nonaktif dan tidak menerima pointer, tetapi labelnya tetap terbaca.

### Navigation

- **Style:** sidebar padat dengan item setinggi 2rem, ikon 1rem, label sentence case, dan hierarchy kelompok yang stabil.
- **States:** hover, active, keyboard focus, dan expanded harus berbeda jelas. Sidebar yang runtuh menyediakan tooltip dan tetap dapat dioperasikan dengan keyboard.
- **Mobile:** navigasi berpindah ke sheet; trigger mempunyai nama aksesibel dan target sentuh yang cukup.

### Tables

- **Style:** teks 0.875rem, header medium-weight, cell padding 0.5rem, divider horizontal, serta hover row yang ringan.
- **Behavior:** aksi baris berada di kolom konsisten; selection, loading, empty, error, dan pagination mempunyai feedback yang eksplisit.
- **Responsive:** pertahankan kolom keputusan, sembunyikan detail sekunder secara terencana, dan sediakan jalur ke detail lengkap. Jangan sekadar memotong tabel pada viewport kecil.

## Do's and Don'ts

### Do:

- **Do** prioritaskan alur keyboard, focus yang terlihat, reflow, kontras WCAG 2.2 AA, serta target sentuh yang memadai.
- **Do** tempatkan quick actions repetitif dekat dengan data yang dipengaruhi dan pertahankan posisinya secara konsisten.
- **Do** tampilkan loading, empty, error, success, dan retry state dengan Bahasa Indonesia yang jelas.
- **Do** gunakan alignment, spacing, border, dan typography untuk membuat data rinci mudah dipindai.
- **Do** pertahankan primitive dan pola interaksi shadcn/ui kecuali bukti usability menuntut perubahan.

### Don't:

- **Don't** memakai shadow berat, gradient dekoratif, glassmorphism, atau animasi mencolok untuk membuat dashboard terasa menarik.
- **Don't** mengandalkan warna saja untuk membedakan status, pilihan, error, atau keberhasilan.
- **Don't** menyembunyikan aksi penting hanya di balik hover atau menu tanpa jalur keyboard dan touch yang setara.
- **Don't** mengejar kepadatan dengan teks terlalu kecil, target klik sempit, atau informasi yang terpotong tanpa jalan menuju detail.
- **Don't** mencampur Bahasa Indonesia dan istilah teknis internal pada tugas yang dihadapi admin.
