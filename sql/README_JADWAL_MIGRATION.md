# Jadwal Absensi - Migration Guide

## Overview
Fitur konfigurasi jadwal absensi memungkinkan admin untuk mengatur jadwal masuk dan pulang untuk setiap hari dalam seminggu, lengkap dengan kompensasi waktu untuk toleransi keterlambatan.

## Database Changes

### New Table: `jadwal_absensi`
```sql
CREATE TABLE public.jadwal_absensi (
    id INTEGER PRIMARY KEY NOT NULL,
    hari VARCHAR(20) NOT NULL CHECK (hari IN ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu')),
    mulai_masuk VARCHAR(8) NOT NULL,      -- Format: HH:MM:SS
    selesai_masuk VARCHAR(8) NOT NULL,    -- Format: HH:MM:SS
    mulai_pulang VARCHAR(8) NOT NULL,     -- Format: HH:MM:SS
    selesai_pulang VARCHAR(8) NOT NULL,   -- Format: HH:MM:SS
    kompensasi_waktu INTEGER NOT NULL DEFAULT 0,  -- in minutes (0-120)
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### Helper Functions
1. **get_current_day_schedule()** - Mendapatkan jadwal untuk hari ini
2. **is_within_attendance_window(window_type)** - Mengecek apakah waktu saat ini berada dalam window absensi

## Migration Steps

### Option 1: Fresh Database Setup (Recommended untuk development baru)
```bash
# Gunakan schema enhanced v2 yang sudah termasuk jadwal_absensi
psql -U postgres -d your_database -f sql/schema_enhanced_v2.sql
```

### Option 2: Existing Database Migration
```bash
# Jalankan migration script untuk menambahkan tabel jadwal_absensi
psql -U postgres -d your_database -f sql/migration_jadwal_absensi.sql
```

### Supabase Dashboard
1. Buka Supabase Dashboard → SQL Editor
2. Copy isi file `sql/migration_jadwal_absensi.sql`
3. Paste dan run query
4. Atau gunakan `sql/schema_enhanced_v2.sql` untuk fresh install

## Code Changes

### 1. Schema (src/server/db/schema.ts)
Added `jadwalAbsensi` table definition:
```typescript
export const jadwalAbsensi = pgTable("jadwal_absensi", {
  id: integer("id").primaryKey().notNull(),
  hari: varchar("hari", { length: 20 }).notNull(),
  mulaiMasuk: varchar("mulai_masuk", { length: 8 }).notNull(),
  selesaiMasuk: varchar("selesai_masuk", { length: 8 }).notNull(),
  mulaiPulang: varchar("mulai_pulang", { length: 8 }).notNull(),
  selesaiPulang: varchar("selesai_pulang", { length: 8 }).notNull(),
  kompensasiWaktu: integer("kompensasi_waktu").notNull().default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
```

### 2. TRPC Router (src/server/api/routers/jadwal.ts)
New router dengan endpoints:
- `getAll` - Get all schedules
- `getByHari` - Get schedule by day name
- `getById` - Get schedule by ID
- `getCurrentDay` - Get today's schedule
- `getActive` - Get only active schedules
- `update` - Update schedule by ID
- `updateBatch` - Update multiple schedules
- `toggleActive` - Toggle active status
- `reset` - Reset all schedules to default
- `getStats` - Get schedule statistics

### 3. App Router (src/server/api/root.ts)
Added jadwal router:
```typescript
import { jadwalRouter } from "~/server/api/routers/jadwal";

export const appRouter = createTRPCRouter({
  // ... existing routers
  jadwal: jadwalRouter,
});
```

### 4. Page Component (src/app/(main)/jadwal/page.tsx)
New page with features:
- Table view showing all 7 days
- Edit form for each day
- Toggle active/inactive status
- Statistics cards
- Reset to default functionality
- Consistent design with konfigurasi page

## Features

### UI Features
✅ **Statistics Dashboard**
- Total hari
- Hari aktif
- Hari libur
- Rata-rata kompensasi waktu

✅ **Schedule Management**
- View all 7 days in table format
- Edit individual day schedules
- Toggle active/inactive status per day
- Visual indicators (badges, colors)
- Time input with validation

✅ **Form Validation**
- Time format validation (HH:MM)
- Compensation time range (0-120 minutes)
- Required field validation
- Real-time feedback via toast notifications

✅ **Responsive Design**
- Mobile-friendly layout
- Grid-based form layout
- Consistent with app theme

### Default Schedule
```
Senin-Kamis: 06:30-07:30 (masuk), 15:00-16:00 (pulang), Kompensasi 15 menit, Aktif
Jumat:       06:30-07:30 (masuk), 11:00-12:00 (pulang), Kompensasi 15 menit, Aktif
Sabtu:       06:30-07:30 (masuk), 12:00-13:00 (pulang), Kompensasi 15 menit, Nonaktif
Minggu:      06:30-07:30 (masuk), 15:00-16:00 (pulang), Kompensasi 15 menit, Nonaktif
```

## Security (RLS Policies)

### View Permission
- **Everyone** dapat melihat jadwal (authenticated users)

### Edit Permission
- **Admin only** dapat mengedit jadwal
- Protected dengan RLS policy

```sql
-- Everyone can view schedule
CREATE POLICY "Everyone can view schedule" ON public.jadwal_absensi
    FOR SELECT USING (true);

-- Only admins can manage schedule
CREATE POLICY "Admins can manage schedule" ON public.jadwal_absensi
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );
```

## Usage Examples

### Get Today's Schedule
```typescript
const { data: todaySchedule } = api.jadwal.getCurrentDay.useQuery();
```

### Check if within attendance window
```sql
-- From SQL
SELECT is_within_attendance_window('masuk');  -- Returns true/false
SELECT is_within_attendance_window('pulang'); -- Returns true/false
```

### Update Schedule
```typescript
updateMutation.mutate({
  id: 1, // Senin
  data: {
    mulaiMasuk: "06:00:00",
    selesaiMasuk: "07:00:00",
    kompensasiWaktu: 20,
  },
});
```

## Testing

### Verify Database
```sql
-- Check if table exists
SELECT * FROM public.jadwal_absensi ORDER BY id;

-- Test helper function
SELECT * FROM get_current_day_schedule();

-- Test attendance window check
SELECT is_within_attendance_window('masuk') as can_check_in;
```

### Verify API
1. Navigate to `/jadwal` in the app
2. Check statistics display correctly
3. Try editing a day's schedule
4. Toggle active/inactive status
5. Test reset functionality

### Verify Build
```bash
# Lint check
pnpm lint

# Build check
pnpm build

# Dev server
pnpm dev
```

## Files Changed/Added

### New Files
- ✅ `sql/migration_jadwal_absensi.sql` - Migration script
- ✅ `sql/schema_enhanced_v2.sql` - Complete enhanced schema with jadwal
- ✅ `src/server/api/routers/jadwal.ts` - TRPC router
- ✅ `src/app/(main)/jadwal/page.tsx` - UI page component
- ✅ `sql/README_JADWAL_MIGRATION.md` - This file

### Modified Files
- ✅ `src/server/db/schema.ts` - Added jadwalAbsensi table
- ✅ `src/server/api/root.ts` - Added jadwal router

## Rollback

If you need to rollback the changes:

```sql
-- Drop table and related objects
DROP TABLE IF EXISTS public.jadwal_absensi CASCADE;
DROP FUNCTION IF EXISTS get_current_day_schedule();
DROP FUNCTION IF EXISTS is_within_attendance_window(TEXT);
```

Then revert code changes in:
- `src/server/db/schema.ts`
- `src/server/api/root.ts`
- Delete `src/server/api/routers/jadwal.ts`
- Delete `src/app/(main)/jadwal/page.tsx`

## Notes

1. **Time Format**: All times are stored in HH:MM:SS format (24-hour)
2. **Compensation Time**: Added to end time of attendance window (e.g., if selesai_masuk is 07:30 and kompensasi is 15, actual end is 07:45)
3. **Active Status**: Inactive days won't accept attendance (can be used for holidays)
4. **ID Assignment**: IDs 1-7 correspond to days (1=Senin, 7=Minggu)
5. **Default Values**: Pre-populated with typical school schedule

## Support

For issues or questions:
1. Check Supabase logs for RLS policy errors
2. Verify user role is 'admin' for editing
3. Check browser console for API errors
4. Verify database migration completed successfully
