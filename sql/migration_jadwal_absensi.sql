-- ==========================================
-- MIGRATION: JADWAL ABSENSI TABLE
-- Attendance Schedule Configuration System
-- ==========================================

-- Create jadwal_absensi table
CREATE TABLE IF NOT EXISTS public.jadwal_absensi (
    id INTEGER PRIMARY KEY NOT NULL,
    hari VARCHAR(20) NOT NULL CHECK (hari IN ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu')),
    mulai_masuk VARCHAR(8) NOT NULL,
    selesai_masuk VARCHAR(8) NOT NULL,
    mulai_pulang VARCHAR(8) NOT NULL,
    selesai_pulang VARCHAR(8) NOT NULL,
    kompensasi_waktu INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Add comment
COMMENT ON TABLE public.jadwal_absensi IS 'Konfigurasi jadwal absensi per hari untuk sistem kehadiran';
COMMENT ON COLUMN public.jadwal_absensi.hari IS 'Nama hari (senin-minggu)';
COMMENT ON COLUMN public.jadwal_absensi.mulai_masuk IS 'Waktu mulai absen masuk (HH:MM:SS)';
COMMENT ON COLUMN public.jadwal_absensi.selesai_masuk IS 'Waktu selesai absen masuk (HH:MM:SS)';
COMMENT ON COLUMN public.jadwal_absensi.mulai_pulang IS 'Waktu mulai absen pulang (HH:MM:SS)';
COMMENT ON COLUMN public.jadwal_absensi.selesai_pulang IS 'Waktu selesai absen pulang (HH:MM:SS)';
COMMENT ON COLUMN public.jadwal_absensi.kompensasi_waktu IS 'Kompensasi waktu dalam menit untuk toleransi keterlambatan';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_jadwal_absensi_hari ON public.jadwal_absensi(hari);
CREATE INDEX IF NOT EXISTS idx_jadwal_absensi_is_active ON public.jadwal_absensi(is_active);

-- Create trigger for automatic updated_at update
CREATE OR REPLACE FUNCTION update_jadwal_absensi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jadwal_absensi_updated_at_trigger
    BEFORE UPDATE ON public.jadwal_absensi
    FOR EACH ROW EXECUTE FUNCTION update_jadwal_absensi_updated_at();

-- Insert default schedule data for all 7 days
-- Format: HH:MM:SS
INSERT INTO public.jadwal_absensi (
    id, 
    hari, 
    mulai_masuk, 
    selesai_masuk, 
    mulai_pulang, 
    selesai_pulang, 
    kompensasi_waktu,
    is_active
) VALUES
    -- Senin: Masuk 06:30-07:30, Pulang 15:00-16:00, Kompensasi 15 menit
    (1, 'senin', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, true),
    
    -- Selasa: Masuk 06:30-07:30, Pulang 15:00-16:00, Kompensasi 15 menit
    (2, 'selasa', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, true),
    
    -- Rabu: Masuk 06:30-07:30, Pulang 15:00-16:00, Kompensasi 15 menit
    (3, 'rabu', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, true),
    
    -- Kamis: Masuk 06:30-07:30, Pulang 15:00-16:00, Kompensasi 15 menit
    (4, 'kamis', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, true),
    
    -- Jumat: Masuk 06:30-07:30, Pulang 11:00-12:00 (half day), Kompensasi 15 menit
    (5, 'jumat', '06:30:00', '07:30:00', '11:00:00', '12:00:00', 15, true),
    
    -- Sabtu: Masuk 06:30-07:30, Pulang 12:00-13:00, Kompensasi 15 menit (optional)
    (6, 'sabtu', '06:30:00', '07:30:00', '12:00:00', '13:00:00', 15, false),
    
    -- Minggu: Libur (inactive by default)
    (7, 'minggu', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, false)
ON CONFLICT (id) DO UPDATE SET
    hari = EXCLUDED.hari,
    mulai_masuk = EXCLUDED.mulai_masuk,
    selesai_masuk = EXCLUDED.selesai_masuk,
    mulai_pulang = EXCLUDED.mulai_pulang,
    selesai_pulang = EXCLUDED.selesai_pulang,
    kompensasi_waktu = EXCLUDED.kompensasi_waktu,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ==========================================
-- RLS (Row Level Security) Policies
-- ==========================================

-- Enable RLS
ALTER TABLE public.jadwal_absensi ENABLE ROW LEVEL SECURITY;

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

-- Grant necessary permissions
GRANT SELECT ON public.jadwal_absensi TO authenticated;
GRANT ALL ON public.jadwal_absensi TO authenticated;

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to get current day schedule
CREATE OR REPLACE FUNCTION get_current_day_schedule()
RETURNS TABLE (
    id INTEGER,
    hari VARCHAR,
    mulai_masuk VARCHAR,
    selesai_masuk VARCHAR,
    mulai_pulang VARCHAR,
    selesai_pulang VARCHAR,
    kompensasi_waktu INTEGER,
    is_active BOOLEAN
) AS $$
DECLARE
    current_day VARCHAR;
BEGIN
    -- Get current day in Indonesian
    current_day := CASE EXTRACT(DOW FROM CURRENT_DATE)
        WHEN 0 THEN 'minggu'
        WHEN 1 THEN 'senin'
        WHEN 2 THEN 'selasa'
        WHEN 3 THEN 'rabu'
        WHEN 4 THEN 'kamis'
        WHEN 5 THEN 'jumat'
        WHEN 6 THEN 'sabtu'
    END;
    
    RETURN QUERY
    SELECT 
        ja.id,
        ja.hari,
        ja.mulai_masuk,
        ja.selesai_masuk,
        ja.mulai_pulang,
        ja.selesai_pulang,
        ja.kompensasi_waktu,
        ja.is_active
    FROM public.jadwal_absensi ja
    WHERE ja.hari = current_day
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to check if current time is within attendance window
CREATE OR REPLACE FUNCTION is_within_attendance_window(
    window_type TEXT -- 'masuk' or 'pulang'
) RETURNS BOOLEAN AS $$
DECLARE
    schedule RECORD;
    current_time TIME;
    start_time TIME;
    end_time TIME;
    compensation_minutes INTEGER;
BEGIN
    current_time := CURRENT_TIME;
    
    -- Get current day schedule
    SELECT * INTO schedule FROM get_current_day_schedule() LIMIT 1;
    
    IF schedule IS NULL OR schedule.is_active = FALSE THEN
        RETURN FALSE;
    END IF;
    
    compensation_minutes := COALESCE(schedule.kompensasi_waktu, 0);
    
    IF window_type = 'masuk' THEN
        start_time := schedule.mulai_masuk::TIME;
        end_time := schedule.selesai_masuk::TIME + (compensation_minutes || ' minutes')::INTERVAL;
    ELSIF window_type = 'pulang' THEN
        start_time := schedule.mulai_pulang::TIME;
        end_time := schedule.selesai_pulang::TIME + (compensation_minutes || ' minutes')::INTERVAL;
    ELSE
        RETURN FALSE;
    END IF;
    
    RETURN current_time BETWEEN start_time AND end_time;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_current_day_schedule TO authenticated;
GRANT EXECUTE ON FUNCTION is_within_attendance_window TO authenticated;

COMMENT ON FUNCTION get_current_day_schedule IS 'Mendapatkan jadwal absensi untuk hari ini';
COMMENT ON FUNCTION is_within_attendance_window IS 'Mengecek apakah waktu saat ini berada dalam window absensi masuk/pulang';
