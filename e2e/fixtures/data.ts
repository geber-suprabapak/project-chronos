export interface MockStudent {
  user_id: string;
  full_name: string;
  email: string;
  nis: string;
  class_name: string;
  absence_number: string;
  gender: "L" | "P";
  lifecycle_status: "approved" | "pending" | "rejected";
  avatar_url?: string | null;
  role: "student";
}

export interface MockStaff {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  roles: string[];
  gender: "L" | "P";
  created_at: string;
  updated_at: string;
}

export interface MockClass {
  id: string;
  name: string;
  grade: number;
}

export interface MockAttendance {
  id: string;
  user_id: string;
  date: string;
  status: "Hadir" | "Terlambat" | "Pulang" | "Alpha" | "Datang";
  action_type: "check_in" | "check_out" | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface MockLeaveRequest {
  id: string;
  user_id: string;
  student_name: string;
  student_nis: string;
  student_class: string;
  absence_number: string;
  category: "sakit" | "pergi" | "dispensasi" | "lainnya";
  description: string | null;
  status: boolean;
  date: string;
  approval_status: "approved" | "rejected" | "pending";
  attachment_url: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockLocation {
  id: string;
  school_id?: string | null;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MockSchedule {
  id: string;
  day_of_week: string;
  hari?: string;
  start_time: string;
  end_time: string;
  start_checkout: string;
  end_checkout: string;
  grace_period_minutes: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export function getTodayDateStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function createInitialMockData() {
  const today = getTodayDateStr();

  const students: MockStudent[] = [
    {
      user_id: "00000000-0000-0000-0000-000000000001",
      full_name: "Ahmad Dahlan",
      email: "ahmad@skanida.sch.id",
      nis: "1001",
      class_name: "XII RPL 1",
      absence_number: "01",
      gender: "L",
      lifecycle_status: "approved",
      avatar_url:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
      role: "student",
    },
    {
      user_id: "00000000-0000-0000-0000-000000000002",
      full_name: "Siti Rahmawati",
      email: "siti@skanida.sch.id",
      nis: "1002",
      class_name: "XII RPL 1",
      absence_number: "02",
      gender: "P",
      lifecycle_status: "approved",
      avatar_url:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
      role: "student",
    },
    {
      user_id: "00000000-0000-0000-0000-000000000003",
      full_name: "Budi Santoso",
      email: "budi@skanida.sch.id",
      nis: "1003",
      class_name: "XII RPL 2",
      absence_number: "01",
      gender: "L",
      lifecycle_status: "pending",
      avatar_url: null,
      role: "student",
    },
    {
      user_id: "00000000-0000-0000-0000-000000000004",
      full_name: "Dewi Lestari",
      email: "dewi@skanida.sch.id",
      nis: "1004",
      class_name: "XI TKJ 1",
      absence_number: "01",
      gender: "P",
      lifecycle_status: "approved",
      avatar_url:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80",
      role: "student",
    },
    {
      user_id: "00000000-0000-0000-0000-000000000005",
      full_name: "Eko Prasetyo",
      email: "eko@skanida.sch.id",
      nis: "1005",
      class_name: "X MM 1",
      absence_number: "01",
      gender: "L",
      lifecycle_status: "approved",
      avatar_url: null,
      role: "student",
    },
  ];

  const staff: MockStaff[] = [
    {
      user_id: "10000000-0000-0000-0000-000000000001",
      full_name: "Platform Administrator",
      email: "admin@skanida.sch.id",
      role: "platform_admin",
      roles: ["platform_admin"],
      gender: "L",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      user_id: "10000000-0000-0000-0000-000000000002",
      full_name: "Guru Pengajar",
      email: "teacher@skanida.sch.id",
      role: "teacher",
      roles: ["teacher"],
      gender: "P",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  const classes: MockClass[] = [
    { id: "cls-1", name: "XII RPL 1", grade: 12 },
    { id: "cls-2", name: "XII RPL 2", grade: 12 },
    { id: "cls-3", name: "XI TKJ 1", grade: 11 },
    { id: "cls-4", name: "X MM 1", grade: 10 },
  ];

  const attendances: MockAttendance[] = [
    {
      id: "a0000000-0000-4000-8000-000000000001",
      user_id: "00000000-0000-0000-0000-000000000001",
      date: today,
      status: "Hadir",
      action_type: "check_in",
      latitude: -7.4503,
      longitude: 110.2241,
      created_at: `${today}T06:45:00.000Z`,
    },
    {
      id: "a0000000-0000-4000-8000-000000000002",
      user_id: "00000000-0000-0000-0000-000000000002",
      date: today,
      status: "Terlambat",
      action_type: "check_in",
      latitude: -7.4503,
      longitude: 110.2241,
      created_at: `${today}T07:40:00.000Z`,
    },
    {
      id: "a0000000-0000-4000-8000-000000000003",
      user_id: "00000000-0000-0000-0000-000000000004",
      date: today,
      status: "Pulang",
      action_type: "check_out",
      latitude: -7.4503,
      longitude: 110.2241,
      created_at: `${today}T15:10:00.000Z`,
    },
    {
      id: "a0000000-0000-4000-8000-000000000004",
      user_id: "00000000-0000-0000-0000-000000000005",
      date: today,
      status: "Alpha",
      action_type: null,
      latitude: null,
      longitude: null,
      created_at: `${today}T08:00:00.000Z`,
    },
  ];

  const leaveRequests: MockLeaveRequest[] = [
    {
      id: "b0000000-0000-4000-8000-000000000001",
      user_id: "00000000-0000-0000-0000-000000000001",
      student_name: "Ahmad Dahlan",
      student_nis: "1001",
      student_class: "XII RPL 1",
      absence_number: "01",
      category: "sakit",
      description: "Demam tinggi dan flu",
      status: false,
      date: today,
      approval_status: "pending",
      attachment_url:
        "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982",
      created_at: `${today}T06:30:00.000Z`,
      updated_at: `${today}T06:30:00.000Z`,
    },
    {
      id: "b0000000-0000-4000-8000-000000000002",
      user_id: "00000000-0000-0000-0000-000000000002",
      student_name: "Siti Rahmawati",
      student_nis: "1002",
      student_class: "XII RPL 1",
      absence_number: "02",
      category: "pergi",
      description: "Acara keluarga di luar kota",
      status: true,
      date: today,
      approval_status: "approved",
      attachment_url: null,
      created_at: `${today}T06:00:00.000Z`,
      updated_at: `${today}T06:15:00.000Z`,
    },
    {
      id: "b0000000-0000-4000-8000-000000000003",
      user_id: "00000000-0000-0000-0000-000000000004",
      student_name: "Dewi Lestari",
      student_nis: "1004",
      student_class: "XI TKJ 1",
      absence_number: "01",
      category: "sakit",
      description: "Sakit kepala ringan",
      status: false,
      date: today,
      approval_status: "rejected",
      rejection_reason: "Surat keterangan dokter belum dilampirkan",
      rejected_at: `${today}T07:00:00.000Z`,
      attachment_url: null,
      created_at: `${today}T06:00:00.000Z`,
      updated_at: `${today}T07:00:00.000Z`,
    },
  ];

  const locations: MockLocation[] = [
    {
      id: "1",
      name: "Kantor Pusat",
      latitude: -7.4503,
      longitude: 110.2241,
      radius_meters: 500,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "2",
      name: "Kampus 2 Skanida",
      latitude: -7.46,
      longitude: 110.23,
      radius_meters: 300,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  const schedules: MockSchedule[] = [
    {
      id: "1",
      day_of_week: "senin",
      hari: "senin",
      start_time: "06:30:00",
      end_time: "07:30:00",
      start_checkout: "15:00:00",
      end_checkout: "16:00:00",
      grace_period_minutes: 15,
      is_active: true,
    },
    {
      id: "2",
      day_of_week: "selasa",
      hari: "selasa",
      start_time: "06:30:00",
      end_time: "07:30:00",
      start_checkout: "15:00:00",
      end_checkout: "16:00:00",
      grace_period_minutes: 15,
      is_active: true,
    },
    {
      id: "3",
      day_of_week: "rabu",
      hari: "rabu",
      start_time: "06:30:00",
      end_time: "07:30:00",
      start_checkout: "15:00:00",
      end_checkout: "16:00:00",
      grace_period_minutes: 15,
      is_active: true,
    },
    {
      id: "4",
      day_of_week: "kamis",
      hari: "kamis",
      start_time: "06:30:00",
      end_time: "07:30:00",
      start_checkout: "15:00:00",
      end_checkout: "16:00:00",
      grace_period_minutes: 15,
      is_active: true,
    },
    {
      id: "5",
      day_of_week: "jumat",
      hari: "jumat",
      start_time: "06:30:00",
      end_time: "07:30:00",
      start_checkout: "11:00:00",
      end_checkout: "12:00:00",
      grace_period_minutes: 15,
      is_active: true,
    },
    {
      id: "6",
      day_of_week: "sabtu",
      hari: "sabtu",
      start_time: "06:30:00",
      end_time: "07:30:00",
      start_checkout: "12:00:00",
      end_checkout: "13:00:00",
      grace_period_minutes: 15,
      is_active: false,
    },
    {
      id: "7",
      day_of_week: "minggu",
      hari: "minggu",
      start_time: "06:30:00",
      end_time: "07:30:00",
      start_checkout: "15:00:00",
      end_checkout: "16:00:00",
      grace_period_minutes: 15,
      is_active: false,
    },
  ];

  return {
    students,
    staff,
    classes,
    attendances,
    leaveRequests,
    locations,
    schedules,
  };
}
