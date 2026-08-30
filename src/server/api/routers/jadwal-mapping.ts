const HARI_TO_ID = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
  minggu: 7,
} as const;

const ID_TO_HARI = {
  1: "senin",
  2: "selasa",
  3: "rabu",
  4: "kamis",
  5: "jumat",
  6: "sabtu",
  7: "minggu",
} as const;

export const HARI_ENUM = [
  "senin",
  "selasa",
  "rabu",
  "kamis",
  "jumat",
  "sabtu",
  "minggu",
] as const;

export type Hari = (typeof HARI_ENUM)[number];
export type DayId = keyof typeof ID_TO_HARI;

export function isHari(val: string): val is Hari {
  return Object.prototype.hasOwnProperty.call(HARI_TO_ID, val);
}

export function isDayId(id: number): id is DayId {
  return Object.prototype.hasOwnProperty.call(ID_TO_HARI, id);
}

export interface AstraSchedule {
  id: string;
  school_id?: string | null;
  class_id?: string | null;
  academic_period_id?: string | null;
  location_id?: string | null;
  day_of_week?: string;
  hari?: string;
  start_time?: string | null;
  end_time?: string | null;
  start_checkout?: string | null;
  end_checkout?: string | null;
  mulai_masuk?: string | null;
  selesai_masuk?: string | null;
  mulai_pulang?: string | null;
  selesai_pulang?: string | null;
  grace_period_minutes?: number | null;
  kompensasi_waktu?: number | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export function mapAstraSchedule(sched: AstraSchedule, indexFallback?: number) {
  const hariRaw = (sched.hari ?? sched.day_of_week ?? "senin").toLowerCase();
  const hari = isHari(hariRaw) ? hariRaw : "senin";

  // Astra uses UUIDs for schedule records. The Chronos UI uses one stable
  // numeric key per weekday; keep the Astra id separately for mutations.
  const safeId = HARI_TO_ID[hari] ?? indexFallback ?? 1;

  const formatTime = (t?: string | null, fallback = "00:00:00") => {
    if (!t) return fallback;
    if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
    return t;
  };

  return {
    id: safeId,
    astraId: sched.id,
    hari,
    mulaiMasuk: formatTime(sched.mulai_masuk ?? sched.start_time, "06:30:00"),
    selesaiMasuk: formatTime(sched.selesai_masuk ?? sched.end_time, "07:30:00"),
    mulaiPulang: formatTime(
      sched.mulai_pulang ?? sched.start_checkout,
      "15:00:00",
    ),
    selesaiPulang: formatTime(
      sched.selesai_pulang ?? sched.end_checkout,
      "16:00:00",
    ),
    kompensasiWaktu: sched.kompensasi_waktu ?? sched.grace_period_minutes ?? 0,
    isActive: sched.is_active ?? true,
    createdAt: sched.created_at ? new Date(sched.created_at) : new Date(),
    updatedAt: sched.updated_at ? new Date(sched.updated_at) : new Date(),
  };
}

export { HARI_TO_ID, ID_TO_HARI };
