-- ============================================================================
-- Extend auth.users -> user_profiles trigger for non-student account bootstrap
-- Date: 2026-03-10
--
-- Purpose:
-- - Keep existing student bootstrap (NIS + biodata_siswa)
-- - Add support for staff accounts (guru/admin/wali/kepala sekolah)
-- - Ensure profile row exists so RBAC hook can resolve role immediately
-- ============================================================================

BEGIN;

INSERT INTO public.user_profiles (
  user_id,
  full_name,
  email,
  role
)
SELECT
  au.id,
  COALESCE(
    NULLIF(BTRIM(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '')), ''),
    SPLIT_PART(COALESCE(au.email, ''), '@', 1),
    'User'
  ) AS full_name,
  au.email,
  LOWER(au.raw_app_meta_data->>'role') AS role
FROM auth.users AS au
LEFT JOIN public.user_profiles AS up
  ON up.user_id = au.id
WHERE up.user_id IS NULL
  AND LOWER(COALESCE(au.raw_app_meta_data->>'role', '')) IN (
    'admin',
    'kepala_sekolah',
    'guru',
    'wali_kelas'
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_nis_text TEXT;
  user_nis_bigint BIGINT;
  profile_role TEXT;
  profile_full_name TEXT;
BEGIN
  profile_role := lower(COALESCE(NEW.raw_app_meta_data->>'role', ''));
  profile_full_name := NULLIF(
    BTRIM(
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        ''
      )
    ),
    ''
  );

  -- Staff account path: role supplied from auth app_metadata.
  IF profile_role IN ('admin', 'kepala_sekolah', 'guru', 'wali_kelas') THEN
    INSERT INTO public.user_profiles (
      user_id,
      full_name,
      email,
      role
    )
    VALUES (
      NEW.id,
      COALESCE(profile_full_name, SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), 'User'),
      NEW.email,
      profile_role
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = NOW();

    RETURN NEW;
  END IF;

  -- Student account path (existing behavior).
  user_nis_text := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'nis', '')), '');

  IF user_nis_text IS NOT NULL AND user_nis_text ~ '^[0-9]+$' THEN
    user_nis_bigint := user_nis_text::BIGINT;

    INSERT INTO public.user_profiles (
      user_id,
      full_name,
      email,
      nis,
      class_name,
      absence_number,
      gender,
      role
    )
    SELECT
      NEW.id,
      bs.nama,
      NEW.email,
      bs.nis::TEXT,
      bs.kelas,
      bs.absen::TEXT,
      bs.kelamin,
      'siswa'
    FROM public.biodata_siswa AS bs
    WHERE bs.nis = user_nis_bigint
    ON CONFLICT (user_id) DO UPDATE
    SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      nis = EXCLUDED.nis,
      class_name = EXCLUDED.class_name,
      absence_number = EXCLUDED.absence_number,
      gender = EXCLUDED.gender,
      updated_at = NOW();

    UPDATE public.biodata_siswa
    SET activated = true
    WHERE nis = user_nis_bigint;

    RETURN NEW;
  END IF;

  -- Fallback profile so role resolution still has a row.
  INSERT INTO public.user_profiles (
    user_id,
    full_name,
    email,
    nis,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(profile_full_name, SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), 'Siswa'),
    NEW.email,
    user_nis_text,
    'siswa'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    nis = COALESCE(EXCLUDED.nis, public.user_profiles.nis),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMIT;
