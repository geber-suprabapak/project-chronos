-- ==========================================
-- PROJECT CHRONOS - ENHANCED DATABASE SCHEMA v2
-- Complete schema with RLS + Jadwal Absensi
-- ==========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- TABLE DEFINITIONS
-- ==========================================

-- 1. USER PROFILES TABLE
-- Stores extended user information linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nis TEXT,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    absence_number TEXT,
    class_name TEXT,
    gender TEXT CHECK (gender IN ('Laki-laki', 'Perempuan')),
    role TEXT DEFAULT 'siswa' CHECK (role IN ('siswa', 'guru', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. BIODATA SISWA TABLE
-- Master data for student registration and management
CREATE TABLE IF NOT EXISTS public.biodata_siswa (
    nis BIGINT PRIMARY KEY NOT NULL,
    nama TEXT,
    kelas TEXT,
    absen INTEGER,
    kelamin TEXT CHECK (kelamin IN ('Laki-laki', 'Perempuan')),
    activated BOOLEAN DEFAULT FALSE NOT NULL
);

-- 3. LOCATION TABLE
-- System configuration for location-based attendance
CREATE TABLE IF NOT EXISTS public.location (
    id INTEGER PRIMARY KEY NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'Default Location',
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    distance INTEGER NOT NULL CHECK (distance >= 1 AND distance <= 10000),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. JADWAL ABSENSI TABLE
-- Schedule configuration for attendance system
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

-- 5. ABSENCES TABLE
-- Records of student attendance with location verification
CREATE TABLE IF NOT EXISTS public.absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT,
    photo_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_id INTEGER REFERENCES public.location(id),
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Datang', 'Pulang')),
    is_valid_location BOOLEAN DEFAULT FALSE,
    distance_from_school DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. PERIZINAN TABLE
-- Permission/leave requests with approval workflow
CREATE TABLE IF NOT EXISTS public.perizinan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tanggal TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    kategori_izin TEXT NOT NULL CHECK (kategori_izin IN ('sakit', 'pergi', 'keperluan_keluarga', 'lainnya')),
    deskripsi TEXT,
    link_foto TEXT,
    approval_status TEXT DEFAULT 'pending' NOT NULL CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    status BOOLEAN DEFAULT FALSE NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    rejected_at TIMESTAMPTZ,
    rejected_by TEXT,
    tanggal_utc_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_nis ON public.user_profiles(nis);
CREATE INDEX IF NOT EXISTS idx_user_profiles_class_name ON public.user_profiles(class_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- Biodata siswa indexes
CREATE INDEX IF NOT EXISTS idx_biodata_siswa_nama ON public.biodata_siswa(nama);
CREATE INDEX IF NOT EXISTS idx_biodata_siswa_kelas ON public.biodata_siswa(kelas);
CREATE INDEX IF NOT EXISTS idx_biodata_siswa_activated ON public.biodata_siswa(activated);

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_location_is_active ON public.location(is_active);

-- Jadwal absensi indexes
CREATE INDEX IF NOT EXISTS idx_jadwal_absensi_hari ON public.jadwal_absensi(hari);
CREATE INDEX IF NOT EXISTS idx_jadwal_absensi_is_active ON public.jadwal_absensi(is_active);

-- Absences indexes
CREATE INDEX IF NOT EXISTS idx_absences_user_id ON public.absences(user_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON public.absences(date);
CREATE INDEX IF NOT EXISTS idx_absences_status ON public.absences(status);
CREATE INDEX IF NOT EXISTS idx_absences_location_id ON public.absences(location_id);
CREATE INDEX IF NOT EXISTS idx_absences_user_date ON public.absences(user_id, date);

-- Perizinan indexes
CREATE INDEX IF NOT EXISTS idx_perizinan_user_id ON public.perizinan(user_id);
CREATE INDEX IF NOT EXISTS idx_perizinan_tanggal ON public.perizinan(tanggal);
CREATE INDEX IF NOT EXISTS idx_perizinan_approval_status ON public.perizinan(approval_status);
CREATE INDEX IF NOT EXISTS idx_perizinan_tanggal_utc_date ON public.perizinan(tanggal_utc_date);
CREATE INDEX IF NOT EXISTS idx_perizinan_user_date ON public.perizinan(user_id, tanggal_utc_date);

-- ==========================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update tanggal_utc_date for perizinan
CREATE OR REPLACE FUNCTION update_tanggal_utc_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tanggal_utc_date = NEW.tanggal::date;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_location_updated_at ON public.location;
CREATE TRIGGER update_location_updated_at
    BEFORE UPDATE ON public.location
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jadwal_absensi_updated_at ON public.jadwal_absensi;
CREATE TRIGGER update_jadwal_absensi_updated_at
    BEFORE UPDATE ON public.jadwal_absensi
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_absences_updated_at ON public.absences;
CREATE TRIGGER update_absences_updated_at
    BEFORE UPDATE ON public.absences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_perizinan_updated_at ON public.perizinan;
CREATE TRIGGER update_perizinan_updated_at
    BEFORE UPDATE ON public.perizinan
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update tanggal_utc_date
DROP TRIGGER IF EXISTS update_perizinan_tanggal_utc_date ON public.perizinan;
CREATE TRIGGER update_perizinan_tanggal_utc_date
    BEFORE INSERT OR UPDATE ON public.perizinan
    FOR EACH ROW EXECUTE FUNCTION update_tanggal_utc_date();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biodata_siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal_absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perizinan ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
    -- user_profiles
    DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admins and teachers can view all profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admins can insert profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;
    
    -- biodata_siswa
    DROP POLICY IF EXISTS "Teachers and admins can view biodata siswa" ON public.biodata_siswa;
    DROP POLICY IF EXISTS "Admins can manage biodata siswa" ON public.biodata_siswa;
    
    -- location
    DROP POLICY IF EXISTS "Everyone can view active locations" ON public.location;
    DROP POLICY IF EXISTS "Admins can manage locations" ON public.location;
    DROP POLICY IF EXISTS "Teachers can view all locations" ON public.location;
    
    -- jadwal_absensi
    DROP POLICY IF EXISTS "Everyone can view schedule" ON public.jadwal_absensi;
    DROP POLICY IF EXISTS "Admins can manage schedule" ON public.jadwal_absensi;
    
    -- absences
    DROP POLICY IF EXISTS "Users can view own absences" ON public.absences;
    DROP POLICY IF EXISTS "Users can insert own absences" ON public.absences;
    DROP POLICY IF EXISTS "Users can update own recent absences" ON public.absences;
    DROP POLICY IF EXISTS "Teachers and admins can view all absences" ON public.absences;
    DROP POLICY IF EXISTS "Admins can manage all absences" ON public.absences;
    
    -- perizinan
    DROP POLICY IF EXISTS "Users can view own perizinan" ON public.perizinan;
    DROP POLICY IF EXISTS "Users can insert own perizinan" ON public.perizinan;
    DROP POLICY IF EXISTS "Users can update own pending perizinan" ON public.perizinan;
    DROP POLICY IF EXISTS "Teachers and admins can view all perizinan" ON public.perizinan;
    DROP POLICY IF EXISTS "Teachers can approve perizinan" ON public.perizinan;
    DROP POLICY IF EXISTS "Admins can manage all perizinan" ON public.perizinan;
END $$;

-- USER_PROFILES POLICIES
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins and teachers can view all profiles" ON public.user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

CREATE POLICY "Admins can insert profiles" ON public.user_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update any profile" ON public.user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- BIODATA_SISWA POLICIES
CREATE POLICY "Teachers and admins can view biodata siswa" ON public.biodata_siswa
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

CREATE POLICY "Admins can manage biodata siswa" ON public.biodata_siswa
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- LOCATION POLICIES
CREATE POLICY "Everyone can view active locations" ON public.location
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage locations" ON public.location
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Teachers can view all locations" ON public.location
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

-- JADWAL_ABSENSI POLICIES
CREATE POLICY "Everyone can view schedule" ON public.jadwal_absensi
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage schedule" ON public.jadwal_absensi
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ABSENCES POLICIES
CREATE POLICY "Users can view own absences" ON public.absences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own absences" ON public.absences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recent absences" ON public.absences
    FOR UPDATE USING (
        auth.uid() = user_id 
        AND created_at > NOW() - INTERVAL '24 hours'
    );

CREATE POLICY "Teachers and admins can view all absences" ON public.absences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

CREATE POLICY "Admins can manage all absences" ON public.absences
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- PERIZINAN POLICIES
CREATE POLICY "Users can view own perizinan" ON public.perizinan
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own perizinan" ON public.perizinan
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending perizinan" ON public.perizinan
    FOR UPDATE USING (
        auth.uid() = user_id 
        AND approval_status = 'pending'
    );

CREATE POLICY "Teachers and admins can view all perizinan" ON public.perizinan
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

CREATE POLICY "Teachers can approve perizinan" ON public.perizinan
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

CREATE POLICY "Admins can manage all perizinan" ON public.perizinan
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ==========================================
-- FUNCTIONS FOR APPLICATION LOGIC
-- ==========================================

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    R CONSTANT DOUBLE PRECISION := 6371000; -- Earth's radius in meters
    lat1_rad DOUBLE PRECISION;
    lat2_rad DOUBLE PRECISION;
    delta_lat DOUBLE PRECISION;
    delta_lon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    lat1_rad := radians(lat1);
    lat2_rad := radians(lat2);
    delta_lat := radians(lat2 - lat1);
    delta_lon := radians(lon2 - lon1);
    
    a := sin(delta_lat/2) * sin(delta_lat/2) + 
         cos(lat1_rad) * cos(lat2_rad) * 
         sin(delta_lon/2) * sin(delta_lon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate attendance location
CREATE OR REPLACE FUNCTION validate_attendance_location()
RETURNS TRIGGER AS $$
DECLARE
    school_location RECORD;
    distance_m DOUBLE PRECISION;
BEGIN
    -- Get the active school location
    SELECT longitude, latitude, distance 
    INTO school_location 
    FROM public.location 
    WHERE is_active = true 
    ORDER BY id 
    LIMIT 1;
    
    IF school_location IS NOT NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        -- Calculate distance
        distance_m := calculate_distance(
            NEW.latitude,
            NEW.longitude,
            school_location.latitude,
            school_location.longitude
        );
        
        -- Update fields based on validation
        NEW.distance_from_school := distance_m;
        NEW.is_valid_location := (distance_m <= school_location.distance);
        NEW.location_id := (
            SELECT id FROM public.location 
            WHERE is_active = true 
            ORDER BY id 
            LIMIT 1
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger for attendance location validation
DROP TRIGGER IF EXISTS validate_attendance_location_trigger ON public.absences;
CREATE TRIGGER validate_attendance_location_trigger
    BEFORE INSERT OR UPDATE ON public.absences
    FOR EACH ROW EXECUTE FUNCTION validate_attendance_location();

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

-- ==========================================
-- INITIAL DATA
-- ==========================================

-- Insert default location (example: Yogyakarta coordinates)
INSERT INTO public.location (
    id, 
    name, 
    longitude, 
    latitude, 
    distance,
    is_active
) VALUES (
    1,
    'Sekolah Utama',
    110.2241,
    -7.4503,
    500,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    longitude = EXCLUDED.longitude,
    latitude = EXCLUDED.latitude,
    distance = EXCLUDED.distance,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Insert default schedule data for all 7 days
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
    (1, 'senin', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, true),
    (2, 'selasa', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, true),
    (3, 'rabu', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, true),
    (4, 'kamis', '06:30:00', '07:30:00', '15:00:00', '16:00:00', 15, true),
    (5, 'jumat', '06:30:00', '07:30:00', '11:00:00', '12:00:00', 15, true),
    (6, 'sabtu', '06:30:00', '07:30:00', '12:00:00', '13:00:00', 15, false),
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
-- VIEWS FOR COMMON QUERIES
-- ==========================================

-- View for attendance summary
CREATE OR REPLACE VIEW attendance_summary AS
SELECT 
    up.full_name,
    up.class_name,
    up.nis,
    a.date,
    a.status,
    a.is_valid_location,
    a.distance_from_school,
    a.created_at as attendance_time
FROM public.absences a
JOIN public.user_profiles up ON a.user_id = up.user_id
ORDER BY a.date DESC, a.created_at DESC;

-- View for permission requests with user details
CREATE OR REPLACE VIEW perizinan_detail AS
SELECT 
    p.id,
    up.full_name,
    up.class_name,
    up.nis,
    p.tanggal,
    p.kategori_izin,
    p.deskripsi,
    p.approval_status,
    p.approved_at,
    p.rejection_reason,
    approver.full_name as approved_by_name,
    p.created_at
FROM public.perizinan p
JOIN public.user_profiles up ON p.user_id = up.user_id
LEFT JOIN public.user_profiles approver ON p.approved_by = approver.user_id
ORDER BY p.created_at DESC;

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON SCHEMA public IS 'Project Chronos - Student Attendance System with Schedule Management';
COMMENT ON TABLE public.jadwal_absensi IS 'Konfigurasi jadwal absensi per hari untuk sistem kehadiran';
COMMENT ON COLUMN public.jadwal_absensi.kompensasi_waktu IS 'Kompensasi waktu dalam menit untuk toleransi keterlambatan';
COMMENT ON FUNCTION get_current_day_schedule IS 'Mendapatkan jadwal absensi untuk hari ini';
COMMENT ON FUNCTION is_within_attendance_window IS 'Mengecek apakah waktu saat ini berada dalam window absensi masuk/pulang';
