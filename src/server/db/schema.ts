// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { relations, sql } from "drizzle-orm";
import {
  uniqueIndex,
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  date,
  doublePrecision,
  bigint,
  integer,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */

/**
 * Public schema tables from Supabase
 */

// absences
export const absences = pgTable(
  "absences",
  {
    // Match new SQL schema: UUID primary key with default gen_random_uuid()
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey().notNull(),
    userId: uuid("user_id").notNull(), // Foreign key to auth.users(id)
    date: date("date").notNull(),
    reason: text("reason"),
    photoUrl: text("photo_url"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    status: text("status").notNull(),
  },
  (t) => [
    // Match the DB check constraint: status IN ('Hadir', 'Datang', 'Pulang')
    sql`CONSTRAINT absences_status_check CHECK (${t.status} = ANY (ARRAY['Hadir','Datang','Pulang']))`,
  ],
);

// user_profiles
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .notNull()
      .primaryKey(),
    userId: uuid("user_id").notNull(), // Foreign key to auth.users(id)
    nis: text("nis"),
    fullName: text("full_name"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    absenceNumber: text("absence_number"),
    className: text("class_name"),
    gender: text("gender"), // New field from schema
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    role: text("role"),
  },
  (t) => [
    uniqueIndex("user_profiles_user_id_unique").on(t.userId),
  ],
);

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  perizinan: many(perizinan),
}));

// perizinan
export const perizinan = pgTable(
  "perizinan",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .notNull()
      .primaryKey(),
    userId: uuid("user_id").notNull(), // Foreign key to auth.users(id)
    // New schema uses timestamptz for tanggal with default now()
    tanggal: timestamp("tanggal", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    kategoriIzin: text("kategori_izin").notNull(),
    deskripsi: text("deskripsi"),
    linkFoto: text("link_foto"),
    approvalStatus: text("approval_status")
      .default(sql`'pending'`)
      .notNull(),
    status: boolean("status").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    approvedBy: uuid("approved_by"), // Foreign key to auth.users(id)
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedBy: text("rejected_by"),
    // Helper column maintained by trigger for per-day uniqueness and filtering
    tanggalUtcDate: date("tanggal_utc_date"),
  },
  (t) => [
    // Match the DB check constraint: kategori_izin IN ('sakit', 'pergi')
    sql`CONSTRAINT perizinan_kategori_izin_check CHECK (${t.kategoriIzin} = ANY (ARRAY['sakit','pergi']))`,
    // Match the DB check constraint: approval_status IN ('pending', 'approved', 'rejected')
    sql`CONSTRAINT perizinan_approval_status_check CHECK (${t.approvalStatus} = ANY (ARRAY['pending','approved','rejected']))`,
  ],
);

export const perizinanRelations = relations(perizinan, ({ one }) => ({
  userProfile: one(userProfiles, {
    fields: [perizinan.userId],
    references: [userProfiles.userId],
  }),
}));

// biodata_siswa - Student master data for registration
export const biodataSiswa = pgTable("biodata_siswa", {
  nis: bigint("nis", { mode: "bigint" }).primaryKey().notNull(),
  nama: text("nama"),
  kelas: text("kelas"),
  absen: integer("absen"),
  kelamin: text("kelamin"),
  activated: boolean("activated").default(false).notNull(),
});

// ========== Attendance Configuration Tables ==========

// Single row with geofence center + radius
export const attendanceSettings = pgTable("attendance_settings", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey().notNull(),
  centerLatitude: doublePrecision("center_latitude").notNull(),
  centerLongitude: doublePrecision("center_longitude").notNull(),
  radiusMeters: integer("radius_meters").notNull().default(100),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

// Default hours per day (1=Senin ... 7=Minggu). Mostly we will use 1..5.
export const attendanceDefaultHours = pgTable("attendance_default_hours", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey().notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 1-7
  startTime: text("start_time").notNull(), // HH:MM (24h)
  endTime: text("end_time").notNull(), // HH:MM (24h)
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

// Special days: holiday / early dismissal / custom override
export const attendanceSpecialDays = pgTable("attendance_special_days", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey().notNull(),
  date: date("date").notNull(),
  type: text("type").notNull(), // holiday | early_dismissal | custom
  name: text("name"),
  startTime: text("start_time"), // optional override
  endTime: text("end_time"), // optional override
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`).notNull(),
});
