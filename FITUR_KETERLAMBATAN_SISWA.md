# Fitur Deteksi Keterlambatan Siswa

## 📋 Deskripsi
Fitur ini mendeteksi dan menampilkan status keterlambatan siswa secara **runtime** (tanpa mengubah database schema). Keterlambatan dihitung berdasarkan konfigurasi jadwal absensi dengan logika periode kompensasi.

## 🎯 Logika Keterlambatan

### Konsep Dasar
Siswa dianggap **TERLAMBAT** jika:
- Absen **SETELAH** waktu `mulaiMasuk`
- Tapi **MASIH DALAM** periode `kompensasiWaktu`

### Contoh Perhitungan

**Konfigurasi Jadwal Senin:**
- `mulaiMasuk`: 07:00
- `selesaiMasuk`: 07:30
- `kompensasiWaktu`: 15 menit

**Periode Kompensasi:** 07:00 + 15 menit = **07:00 - 07:15**

| Waktu Absen | Status | Keterangan |
|-------------|--------|------------|
| 06:30 | ✅ **Tepat Waktu** | Sebelum mulai masuk |
| 06:55 | ✅ **Tepat Waktu** | Tepat sebelum mulai masuk |
| 07:00 | ✅ **Tepat Waktu** | Tepat waktu mulai masuk |
| 07:05 | ⚠️ **Terlambat 5 menit** | Dalam periode kompensasi |
| 07:10 | ⚠️ **Terlambat 10 menit** | Dalam periode kompensasi |
| 07:15 | ⚠️ **Terlambat 15 menit** | Batas akhir kompensasi |
| 07:16 | ✅ **Tepat Waktu** | Lewat periode kompensasi |
| 07:30 | ✅ **Tepat Waktu** | Masih dalam waktu normal |

**Catatan Penting:**
- Absen **SETELAH** periode kompensasi (>07:15) **TIDAK** dianggap terlambat lagi karena sudah melewati toleransi
- Sistem hanya mendeteksi keterlambatan untuk status "Datang" atau "Hadir"

## 🔧 Implementasi Teknis

### 1. Backend (`src/server/api/routers/absences.ts`)

#### Helper Function
```typescript
function calculateLateStatus(
  createdAt: Date,
  mulaiMasuk: string,
  kompensasiWaktu: number
): { isLate: boolean; lateMinutes: number }
```

**Logic:**
1. Ambil waktu check-in dari `createdAt`
2. Parse `mulaiMasuk` dari jadwal (format HH:MM:SS)
3. Hitung batas akhir = `mulaiMasuk` + `kompensasiWaktu`
4. Jika `checkIn > mulaiMasuk` DAN `checkIn <= batasAkhir`:
   - `isLate = true`
   - `lateMinutes = checkIn - mulaiMasuk`
5. Selain itu: `isLate = false`, `lateMinutes = 0`

#### Endpoint yang Diupdate
- ✅ `list` - Daftar absensi dengan pagination
- ✅ `listRaw` - Semua data absensi
- ✅ `getById` - Detail satu absensi

**Proses:**
1. Query data absensi dari database
2. Query jadwal dari tabel `jadwalAbsensi`
3. Untuk setiap record:
   - Cek hari dari tanggal absen
   - Ambil jadwal untuk hari tersebut
   - Hitung status keterlambatan
   - Enrich data dengan `isLate` dan `lateMinutes`

### 2. Frontend

#### Halaman List (`src/app/(main)/absensi/page.tsx`)
- Tambah kolom "Keterlambatan" di tabel
- Badge merah: "Terlambat X menit" jika `isLate = true`
- Badge abu-abu: "Tepat Waktu" jika `isLate = false`
- Export PDF/Excel include kolom keterlambatan

#### Halaman Detail (`src/app/(main)/absensi/show/[id]/page.tsx`)
- Tampilkan status keterlambatan di card detail
- Konsisten dengan badge di halaman list

## 🎨 UI Components

### Badge Keterlambatan
```tsx
{absence.isLate ? (
  <Badge variant="destructive">
    Terlambat {absence.lateMinutes} menit
  </Badge>
) : (
  <Badge variant="secondary">
    Tepat Waktu
  </Badge>
)}
```

**Variant:**
- `destructive` (merah) = Terlambat
- `secondary` (abu-abu) = Tepat Waktu

## 📊 Alur Kerja

```
1. Siswa absen → Data tersimpan dengan createdAt
                    ↓
2. Backend query absensi
                    ↓
3. Ambil jadwal untuk hari yang sesuai
                    ↓
4. Hitung: apakah absen dalam periode kompensasi?
                    ↓
5. Return data dengan isLate + lateMinutes
                    ↓
6. UI tampilkan badge sesuai status
```

## ⚙️ Konfigurasi

### Mengatur Waktu Kompensasi
1. Buka `/konfigurasi/jadwal`
2. Pilih hari yang ingin diatur
3. Edit nilai "Kompensasi Waktu" (dalam menit)
4. Klik "Simpan"

**Contoh Skenario:**
- Sekolah ingin toleransi 10 menit → set `kompensasiWaktu = 10`
- Sekolah ingin toleransi 20 menit → set `kompensasiWaktu = 20`
- Tidak ada toleransi → set `kompensasiWaktu = 0`

## 🔍 Testing

### Test Case 1: Siswa Tepat Waktu
- Jadwal: mulaiMasuk = 07:00, kompensasi = 15
- Siswa absen: 06:45
- Expected: `isLate = false`, badge "Tepat Waktu"

### Test Case 2: Siswa Terlambat
- Jadwal: mulaiMasuk = 07:00, kompensasi = 15
- Siswa absen: 07:10
- Expected: `isLate = true`, `lateMinutes = 10`, badge "Terlambat 10 menit"

### Test Case 3: Siswa Sangat Terlambat
- Jadwal: mulaiMasuk = 07:00, kompensasi = 15
- Siswa absen: 07:20
- Expected: `isLate = false`, badge "Tepat Waktu" (lewat periode kompensasi)

### Test Case 4: Hari Libur
- Jadwal: isActive = false
- Siswa absen: kapan saja
- Expected: `isLate = false`, badge "Tepat Waktu"

### Test Case 5: Status Pulang
- Status: "Pulang"
- Siswa absen: kapan saja
- Expected: `isLate = false`, badge "Tepat Waktu" (tidak dihitung)

## 📝 Catatan Penting

### ✅ Keuntungan Pendekatan Runtime
1. **Tidak perlu migration database** - Schema tetap sama
2. **Fleksibel** - Ubah konfigurasi jadwal langsung berpengaruh
3. **Historis tetap akurat** - Jika jadwal diubah, perhitungan otomatis update

### ⚠️ Limitasi
1. **Perhitungan setiap request** - Lebih banyak query ke database
2. **Performa** - Untuk dataset sangat besar (>10,000 record), mungkin perlu optimasi
3. **Timezone** - Pastikan server dan client timezone konsisten

### 🎯 Best Practices
1. Set `kompensasiWaktu` sesuai kebijakan sekolah
2. Test dengan data real sebelum production
3. Monitor performa jika data absensi sangat banyak

## 🚀 Deployment

### Checklist
- ✅ Tidak perlu database migration
- ✅ Code sudah di-commit
- ✅ TypeScript check passed
- ✅ Test di development environment
- ✅ Deploy ke production

### Environment
Tidak ada environment variable baru yang perlu ditambahkan.

## 📖 Troubleshooting

### Badge Tidak Muncul
- Clear cache browser (Ctrl+Shift+R)
- Periksa console untuk error
- Pastikan API response include `isLate` dan `lateMinutes`

### Perhitungan Salah
1. Cek konfigurasi jadwal di `/konfigurasi/jadwal`
2. Pastikan `isActive = true` untuk hari tersebut
3. Verifikasi nilai `mulaiMasuk` dan `kompensasiWaktu`
4. Periksa timezone server vs client

### Performance Issue
- Gunakan pagination di halaman list
- Limit jumlah data yang di-fetch
- Consider caching untuk jadwal (jarang berubah)

## 📂 File yang Dimodifikasi

```
src/
├── server/
│   └── api/
│       └── routers/
│           └── absences.ts          # ✅ Tambah calculateLateStatus()
└── app/
    └── (main)/
        └── absensi/
            ├── page.tsx              # ✅ Tambah kolom & badge keterlambatan
            └── show/
                └── [id]/
                    └── page.tsx      # ✅ Tambah badge keterlambatan
```

## 🎓 Kesimpulan

Fitur ini memberikan cara yang **efisien** dan **fleksibel** untuk mendeteksi keterlambatan siswa tanpa perlu mengubah struktur database. Admin dapat dengan mudah mengatur toleransi keterlambatan per hari, dan sistem otomatis menghitung serta menampilkan status keterlambatan secara real-time.

---
**Dibuat:** Oktober 2025
**Versi:** 1.0.0
**Status:** ✅ Production Ready
