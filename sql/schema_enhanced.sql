-- ==========================================
-- PROJECT CHRONOS - ENHANCED DATABASE SCHEMA
-- Complete schema with RLS (Row Level Security)
-- ==========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- TABLE DEFINITIONS
-- ==========================================

-- 1. USER PROFILES TABLE
-- Stores extended user information linked to Supabase auth.users
CREATE TABLE public.user_profiles (
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
CREATE TABLE public.biodata_siswa (
    nis BIGINT PRIMARY KEY NOT NULL,
    nama TEXT,
    kelas TEXT,
    absen INTEGER,
    kelamin TEXT CHECK (kelamin IN ('Laki-laki', 'Perempuan')),
    activated BOOLEAN DEFAULT FALSE NOT NULL
);

-- 3. LOCATION TABLE
-- System configuration for location-based attendance
CREATE TABLE public.location (
    id INTEGER PRIMARY KEY NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    distance INTEGER NOT NULL CHECK (distance >= 1 AND distance <= 10000),
    name TEXT DEFAULT 'Default Location',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. ABSENCES TABLE
-- Records of student attendance with location verification
CREATE TABLE public.absences (
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

-- 5. PERIZINAN TABLE
-- Permission/leave requests with approval workflow
CREATE TABLE public.perizinan (
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
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_nis ON public.user_profiles(nis);
CREATE INDEX idx_user_profiles_class_name ON public.user_profiles(class_name);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);

-- Biodata siswa indexes
CREATE INDEX idx_biodata_siswa_nama ON public.biodata_siswa(nama);
CREATE INDEX idx_biodata_siswa_kelas ON public.biodata_siswa(kelas);
CREATE INDEX idx_biodata_siswa_activated ON public.biodata_siswa(activated);

-- Location indexes
CREATE INDEX idx_location_is_active ON public.location(is_active);

-- Absences indexes
CREATE INDEX idx_absences_user_id ON public.absences(user_id);
CREATE INDEX idx_absences_date ON public.absences(date);
CREATE INDEX idx_absences_status ON public.absences(status);
CREATE INDEX idx_absences_location_id ON public.absences(location_id);
CREATE INDEX idx_absences_user_date ON public.absences(user_id, date);

-- Perizinan indexes
CREATE INDEX idx_perizinan_user_id ON public.perizinan(user_id);
CREATE INDEX idx_perizinan_tanggal ON public.perizinan(tanggal);
CREATE INDEX idx_perizinan_approval_status ON public.perizinan(approval_status);
CREATE INDEX idx_perizinan_tanggal_utc_date ON public.perizinan(tanggal_utc_date);
CREATE INDEX idx_perizinan_user_date ON public.perizinan(user_id, tanggal_utc_date);

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
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_updated_at
    BEFORE UPDATE ON public.location
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_absences_updated_at
    BEFORE UPDATE ON public.absences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_perizinan_updated_at
    BEFORE UPDATE ON public.perizinan
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update tanggal_utc_date
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
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perizinan ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER_PROFILES RLS POLICIES
-- ==========================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Admins and teachers can view all profiles
CREATE POLICY "Admins and teachers can view all profiles" ON public.user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

-- Admins can insert new profiles
CREATE POLICY "Admins can insert profiles" ON public.user_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Admins can update any profile
CREATE POLICY "Admins can update any profile" ON public.user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ==========================================
-- BIODATA_SISWA RLS POLICIES
-- ==========================================

-- Teachers and admins can view biodata siswa
CREATE POLICY "Teachers and admins can view biodata siswa" ON public.biodata_siswa
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

-- Admins can manage biodata siswa
CREATE POLICY "Admins can manage biodata siswa" ON public.biodata_siswa
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ==========================================
-- LOCATION RLS POLICIES
-- ==========================================

-- Everyone can view active locations
CREATE POLICY "Everyone can view active locations" ON public.location
    FOR SELECT USING (is_active = true);

-- Admins can manage all locations
CREATE POLICY "Admins can manage locations" ON public.location
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Teachers can view all locations
CREATE POLICY "Teachers can view all locations" ON public.location
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

-- ==========================================
-- ABSENCES RLS POLICIES
-- ==========================================

-- Users can view their own absences
CREATE POLICY "Users can view own absences" ON public.absences
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own absences
CREATE POLICY "Users can insert own absences" ON public.absences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own absences (limited timeframe)
CREATE POLICY "Users can update own recent absences" ON public.absences
    FOR UPDATE USING (
        auth.uid() = user_id 
        AND created_at > NOW() - INTERVAL '24 hours'
    );

-- Teachers and admins can view all absences
CREATE POLICY "Teachers and admins can view all absences" ON public.absences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

-- Admins can manage all absences
CREATE POLICY "Admins can manage all absences" ON public.absences
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ==========================================
-- PERIZINAN RLS POLICIES
-- ==========================================

-- Users can view their own perizinan
CREATE POLICY "Users can view own perizinan" ON public.perizinan
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own perizinan
CREATE POLICY "Users can insert own perizinan" ON public.perizinan
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending perizinan
CREATE POLICY "Users can update own pending perizinan" ON public.perizinan
    FOR UPDATE USING (
        auth.uid() = user_id 
        AND approval_status = 'pending'
    );

-- Teachers and admins can view all perizinan
CREATE POLICY "Teachers and admins can view all perizinan" ON public.perizinan
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'guru')
        )
    );

-- Teachers can approve/reject perizinan
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

-- Admins can manage all perizinan
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
CREATE TRIGGER validate_attendance_location_trigger
    BEFORE INSERT OR UPDATE ON public.absences
    FOR EACH ROW EXECUTE FUNCTION validate_attendance_location();

-- ==========================================
-- INITIAL DATA
-- ==========================================

-- Insert default location (example: Yogyakarta coordinates)
INSERT INTO public.location (
    id, 
    longitude, 
    latitude, 
    distance, 
    name, 
    description,
    is_active
) VALUES (
    1,
    110.2241,
    -7.4503,
    500,
    'Sekolah Utama',
    'Lokasi utama sekolah untuk sistem absensi',
    true
) ON CONFLICT (id) DO UPDATE SET
    longitude = EXCLUDED.longitude,
    latitude = EXCLUDED.latitude,
    distance = EXCLUDED.distance,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
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
-- SECURITY NOTES
-- ==========================================

/*
RLS POLICY SUMMARY:

1. USER_PROFILES:
   - Users can view/update their own profile
   - Admins/teachers can view all profiles
   - Only admins can create profiles

2. BIODATA_SISWA:
   - Only teachers/admins can access
   - Only admins can modify

3. LOCATION:
   - Everyone can view active locations
   - Only admins can manage locations
   - Teachers can view all locations

4. ABSENCES:
   - Users can view/create their own absences
   - Users can update recent absences (24h window)
   - Teachers/admins can view all absences

5. PERIZINAN:
   - Users can view/create their own requests
   - Users can update pending requests
   - Teachers can approve/reject requests
   - Admins have full access

IMPORTANT: Make sure to set up proper authentication in your application
and ensure that auth.uid() returns the correct user ID from Supabase Auth.
*/

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions for functions
GRANT EXECUTE ON FUNCTION calculate_distance TO authenticated;
GRANT EXECUTE ON FUNCTION validate_attendance_location TO authenticated;
GRANT EXECUTE ON FUNCTION update_updated_at_column TO authenticated;
GRANT EXECUTE ON FUNCTION update_tanggal_utc_date TO authenticated;

COMMENT ON SCHEMA public IS 'Project Chronos - Student Attendance System';
