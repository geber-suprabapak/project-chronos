# Update Label: "Terlambat" → "Dipulangkan"

## 📋 Ringkasan Perubahan

Label untuk siswa yang terlambat dalam periode kompensasi telah diubah dari **"Terlambat X menit"** menjadi **"Dipulangkan"** untuk memberikan kejelasan kebijakan sekolah.

## 🎯 Alasan Perubahan

### Before ❌
```
Badge Orange: "Terlambat 10 menit"
```
**Issue:** Hanya menunjukkan status terlambat, tidak jelas konsekuensinya.

### After ✅
```
Badge Orange: "Dipulangkan"
Tooltip: "Siswa terlambat 10 menit dan dipulangkan"
```
**Benefit:** Jelas menunjukkan bahwa siswa yang terlambat akan dipulangkan.

## 🎨 Visual Update

### Badge di List Page (`/absensi`)

#### Badge Hijau - Absen ✅
```
[✓ Absen]
Tooltip: "Siswa sudah melakukan absensi sesuai jadwal"
```

#### Badge Orange - Dipulangkan ⚠️
```
[⏰ Dipulangkan]
Tooltip: "Siswa terlambat X menit dan dipulangkan (absen dalam periode toleransi keterlambatan)"
```

### Badge di Detail Page (`/absensi/show/[id]`)

#### Badge Orange - Dipulangkan
```
[⏰ Dipulangkan]
Tooltip: "Siswa terlambat X menit dari waktu mulai masuk dan dipulangkan. 
         Absensi dilakukan dalam periode toleransi keterlambatan."
```

### Export PDF/Excel
```
Keterlambatan: "Dipulangkan (10 menit)"
```

## 📊 Contoh Kasus

### Skenario: Jadwal Senin
- **mulaiMasuk:** 07:00
- **kompensasiWaktu:** 15 menit
- **Periode toleransi:** 07:01 - 07:15

| Waktu Absen | Status | Badge | Keterangan |
|-------------|--------|-------|------------|
| 06:50 | Tepat waktu | 🟢 Absen | Sebelum waktu mulai |
| 07:00 | Tepat waktu | 🟢 Absen | Tepat waktu mulai |
| 07:05 | **Terlambat 5 menit** | 🟠 **Dipulangkan** | Dalam periode kompensasi → dipulangkan |
| 07:10 | **Terlambat 10 menit** | 🟠 **Dipulangkan** | Dalam periode kompensasi → dipulangkan |
| 07:15 | **Terlambat 15 menit** | 🟠 **Dipulangkan** | Batas akhir kompensasi → dipulangkan |
| 07:20 | Lewat toleransi | 🟢 Absen | Sudah lewat periode kompensasi |

## 💡 Logika Bisnis

### Kebijakan Keterlambatan
1. **Tepat Waktu (Hijau):**
   - Absen sebelum atau tepat saat `mulaiMasuk`
   - Atau absen setelah periode kompensasi selesai

2. **Dipulangkan (Orange):**
   - Absen **SETELAH** `mulaiMasuk`
   - Tapi **MASIH DALAM** periode `kompensasiWaktu`
   - Siswa dicatat hadir tapi dipulangkan sebagai sanksi

3. **Absen Normal (Hijau):**
   - Absen setelah periode kompensasi
   - Sudah lewat waktu untuk dipulangkan
   - Dianggap absen normal (mungkin dengan catatan)

## 🎯 Tujuan Kebijakan

### Edukatif
- Mengajarkan kedisiplinan waktu
- Konsekuensi jelas untuk keterlambatan

### Administratif  
- Mudah tracking siswa yang sering terlambat
- Data lengkap untuk laporan orang tua

### Visual
- Badge orange langsung menunjukkan "ini masalah"
- Tidak perlu baca detail untuk tahu konsekuensi

## 📱 UI Components

### List Page Badge (Orange)
```tsx
<Badge className="bg-gradient-to-r from-orange-500 to-orange-600">
  <Clock className="animate-pulse" />
  <span>Dipulangkan</span>
</Badge>

Tooltip:
"⚠️ Dipulangkan
Siswa terlambat {minutes} menit dan dipulangkan 
(absen dalam periode toleransi keterlambatan)"
```

### Detail Page Badge (Orange)
```tsx
<Badge className="bg-gradient-to-r from-orange-500 to-orange-600">
  <Clock className="animate-pulse" />
  <span className="font-semibold">Dipulangkan</span>
</Badge>

Tooltip:
"Dipulangkan
Siswa terlambat {minutes} menit dari waktu mulai masuk 
dan dipulangkan. Absensi dilakukan dalam periode 
toleransi keterlambatan."
```

### PDF/Excel Export
```
Status: Dipulangkan (10 menit)
```

## 🔍 Detail Informasi

### Informasi Tambahan di Tooltip

#### Tooltip Orange (Dipulangkan)
- **Title:** ⚠️ Dipulangkan
- **Icon:** Clock (pulsing)
- **Detail:** 
  - Jumlah menit keterlambatan
  - Keterangan dipulangkan
  - Context periode toleransi

#### Tooltip Hijau (Absen)
- **Title:** ✓ Tepat Waktu  
- **Icon:** CheckCircle2
- **Detail:**
  - Siswa absen sesuai jadwal
  - Tidak ada keterlambatan

## 📂 Files Modified

```
src/app/(main)/absensi/
├── page.tsx                    ✅ Badge + tooltip "Dipulangkan"
└── show/[id]/page.tsx          ✅ Badge + tooltip "Dipulangkan"

Changes:
1. Badge text: "Terlambat X menit" → "Dipulangkan"
2. Tooltip title: "Terlambat" → "Dipulangkan"  
3. Tooltip content: Updated dengan info dipulangkan
4. PDF export: "Terlambat X menit" → "Dipulangkan (X menit)"
```

## ✅ Checklist Update

- [x] Update badge text di list page
- [x] Update tooltip di list page
- [x] Update badge text di detail page
- [x] Update tooltip di detail page
- [x] Update PDF/Excel export format
- [x] TypeScript check passed
- [x] No errors
- [x] Documentation updated

## 🚀 Impact

### For Teachers
- ✅ Lebih jelas melihat siswa yang dipulangkan
- ✅ Badge orange = action required (follow up)
- ✅ Tooltip memberikan detail lengkap

### For Admins
- ✅ Data keterlambatan tercatat dengan jelas
- ✅ Laporan lebih informatif
- ✅ Kebijakan terdokumentasi di sistem

### For Students/Parents
- ✅ Konsekuensi keterlambatan jelas
- ✅ Motivasi untuk datang tepat waktu
- ✅ Transparansi sistem

## 💬 Komunikasi dengan Stakeholder

### Untuk Guru
> "Siswa dengan badge orange 'Dipulangkan' adalah siswa yang terlambat 
> dalam periode toleransi dan harus dipulangkan sesuai kebijakan sekolah."

### Untuk Orang Tua
> "Jika anak Anda terlambat dalam periode toleransi (contoh: 1-15 menit 
> setelah waktu masuk), mereka akan dicatat hadir namun dipulangkan 
> sebagai sanksi keterlambatan."

### Untuk Siswa
> "Datang tepat waktu! Jika terlambat dalam periode toleransi, 
> kamu akan dipulangkan dan harus kembali esok hari."

## 📊 Reporting

### Laporan Keterlambatan
```
Bulan: Oktober 2025

Total Siswa Dipulangkan: 15
- Senin: 5 siswa
- Selasa: 3 siswa  
- Rabu: 4 siswa
- Kamis: 2 siswa
- Jumat: 1 siswa

Top 3 Siswa Sering Dipulangkan:
1. Ahmad - 4x
2. Budi - 3x
3. Citra - 2x
```

## 🎓 Best Practices

### Implementasi di Sekolah
1. **Sosialisasi:** Jelaskan kebijakan ke siswa & orang tua
2. **Konsisten:** Terapkan aturan secara konsisten
3. **Follow-up:** Guru piket hubungi orang tua siswa yang dipulangkan
4. **Review:** Evaluasi efektivitas kebijakan setiap semester

### Konfigurasi Optimal
- **Kompensasi 10-15 menit:** Cukup waktu untuk toleransi masuk
- **Terlalu pendek (<5 menit):** Terlalu strict
- **Terlalu panjang (>30 menit):** Kehilangan fungsi disiplin

## 🔮 Future Enhancement (Opsional)

1. **Notifikasi Otomatis:** SMS/WhatsApp ke orang tua saat anak dipulangkan
2. **Counter Pelanggaran:** Track berapa kali siswa dipulangkan per bulan
3. **Reward System:** Siswa tidak pernah terlambat dapat penghargaan
4. **Grafik Trend:** Visualisasi tren keterlambatan per kelas/siswa

---

**Status:** ✅ Production Ready  
**Version:** 2.1.0 (Label Update)  
**Updated:** Oktober 2025  
**Breaking Change:** No (UI text only)  
**Migration Required:** No
