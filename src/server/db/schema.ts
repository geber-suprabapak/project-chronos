// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
  uniqueIndex,
  pgTable,
  bigint,
  uuid,
  text,
  timestamp,
  boolean,
  date,
  doublePrecision,
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
export const absences = pgTable("absences", {
  id: bigint("id", { mode: "number" }).primaryKey().notNull(),
  userId: uuid("user_id").notNull(),
  date: date("date").notNull(),
  reason: text("reason"),
  photoUrl: text("photo_url"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  status: text("status"),
});

// user_profiles
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .notNull()
      .primaryKey(),
    userId: uuid("user_id").notNull(),
    fullName: text("full_name"),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    absenceNumber: text("absence_number"),
    className: text("class_name"),
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
    uniqueIndex("user_profiles_email_unique").on(t.email),
  ],
);

// perizinan
export const perizinan = pgTable(
  "perizinan",
  {
    id: uuid("id")
      .default(sql`extensions.uuid_generate_v4()`)
      .notNull()
      .primaryKey(),
    userId: uuid("user_id").notNull(),
    kategoriIzin: text("kategori_izin").notNull(),
    deskripsi: text("deskripsi").notNull(),
    status: boolean("status").default(false).notNull(),
    linkFoto: text("link_foto"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    tanggal: date("tanggal").notNull(),
    approvalStatus: text("approval_status").default(sql`'pending'`),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedBy: text("rejected_by"),
  },
  (t) => [
    // Match the DB check constraint: kategori_izin IN ('sakit', 'pergi')
    sql`CONSTRAINT perizinan_kategori_izin_check CHECK (${t.kategoriIzin} = ANY (ARRAY['sakit','pergi']))`,
  ],
);
