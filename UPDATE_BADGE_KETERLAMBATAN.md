# Update Badge Keterlambatan - Panduan Visual

## 🎨 Skema Warna Badge

### Badge Hijau (Absen) ✅
- **Warna:** `bg-green-500` (hijau)
- **Hover:** `bg-green-600` (hijau lebih gelap)
- **Text:** `text-white` (putih)
- **Label:** "Absen"
- **Kondisi:** Siswa sudah absen dan **TIDAK terlambat**

### Badge Orange (Terlambat) ⚠️
- **Warna:** `bg-orange-500` (orange)
- **Hover:** `bg-orange-600` (orange lebih gelap)
- **Text:** `text-white` (putih)
- **Label:** "Terlambat X menit"
- **Kondisi:** Siswa terlambat dalam periode kompensasi

## 📊 Contoh Visual

```
┌─────────────────────────────────────────────────┐
│  Daftar Absensi                                 │
├─────────────────────────────────────────────────┤
│ Tanggal    │ Nama      │ Keterlambatan          │
├────────────┼───────────┼────────────────────────┤
│ 2025-10-10 │ Ahmad     │ [🟢 Absen]             │
│ 2025-10-10 │ Budi      │ [🟠 Terlambat 5 menit] │
│ 2025-10-10 │ Citra     │ [🟢 Absen]             │
│ 2025-10-10 │ Dewi      │ [🟠 Terlambat 12 menit]│
└────────────┴───────────┴────────────────────────┘
```

## 🔍 Logic Perhitungan

### Skenario 1: Absen Tepat Waktu (Badge Hijau)
```
Jadwal:
- mulaiMasuk: 07:00
- kompensasiWaktu: 15 menit

Siswa absen: 06:50
Result: isLate = false
Badge: 🟢 "Absen" (hijau)
```

### Skenario 2: Absen Terlambat (Badge Orange)
```
Jadwal:
- mulaiMasuk: 07:00
- kompensasiWaktu: 15 menit

Siswa absen: 07:10
Result: isLate = true, lateMinutes = 10
Badge: 🟠 "Terlambat 10 menit" (orange)
```

## 💻 Implementasi Code

### Halaman List (`/absensi`)
```tsx
{a.isLate ? (
  <Badge className="whitespace-nowrap bg-orange-500 hover:bg-orange-600 text-white">
    Terlambat {a.lateMinutes} menit
  </Badge>
) : (
  <Badge className="whitespace-nowrap bg-green-500 hover:bg-green-600 text-white">
    Absen
  </Badge>
)}
```

### Halaman Detail (`/absensi/show/[id]`)
```tsx
{absence.isLate ? (
  <Badge className="whitespace-nowrap bg-orange-500 hover:bg-orange-600 text-white">
    Terlambat {absence.lateMinutes} menit
  </Badge>
) : (
  <Badge className="whitespace-nowrap bg-green-500 hover:bg-green-600 text-white">
    Absen
  </Badge>
)}
```

## 🎯 Keuntungan Skema Warna Ini

### ✅ Hijau = Positif
- Psikologi warna: hijau = OK, lolos, berhasil
- Mudah dibedakan dari kejauhan
- Standar UI/UX universal

### ⚠️ Orange = Peringatan
- Tidak se-negatif merah (destructive)
- Menandakan "ada masalah tapi tidak fatal"
- Sesuai konteks: terlambat tapi masih dalam toleransi

## 📱 Responsive Design

Badge tetap responsive di semua ukuran layar:
- `whitespace-nowrap`: Text tidak wrap ke baris baru
- Warna konsisten di desktop & mobile
- Hover effect hanya aktif di desktop

## 🧪 Testing Visual

### Test di Browser
1. Buka `/absensi`
2. Cek badge keterlambatan:
   - ✅ Hijau untuk siswa yang absen tepat waktu
   - ⚠️ Orange untuk siswa yang terlambat
3. Hover mouse ke badge → warna lebih gelap
4. Klik detail siswa → badge konsisten

### Test Responsive
1. Resize browser window
2. Test di mobile device
3. Badge harus tetap readable

## 📝 Changelog

### Before
- ❌ Merah (destructive): "Terlambat X menit"
- ⚪ Abu-abu (secondary): "Tepat Waktu"

### After
- ✅ **Hijau (green-500):** "Absen"
- ⚠️ **Orange (orange-500):** "Terlambat X menit"

## 🎨 Color Palette Reference

| Status | Color Code | Tailwind Class | Hex Color |
|--------|------------|----------------|-----------|
| Absen | Green 500 | `bg-green-500` | `#22c55e` |
| Absen (Hover) | Green 600 | `bg-green-600` | `#16a34a` |
| Terlambat | Orange 500 | `bg-orange-500` | `#f97316` |
| Terlambat (Hover) | Orange 600 | `bg-orange-600` | `#ea580c` |

## 🚀 Deployment

File yang diubah:
1. ✅ `src/app/(main)/absensi/page.tsx`
2. ✅ `src/app/(main)/absensi/show/[id]/page.tsx`

**Status:** Ready untuk production ✅

---
**Updated:** Oktober 2025
**Version:** 1.1.0
