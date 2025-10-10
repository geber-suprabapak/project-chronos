CREATE TABLE "absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"reason" text,
	"photo_url" text,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"is_late" boolean DEFAULT false,
	"late_minutes" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "biodata_siswa" (
	"nis" bigint PRIMARY KEY NOT NULL,
	"nama" text,
	"kelas" text,
	"absen" integer,
	"kelamin" text,
	"activated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jadwal_absensi" (
	"id" integer PRIMARY KEY NOT NULL,
	"hari" varchar(20) NOT NULL,
	"mulai_masuk" varchar(8) NOT NULL,
	"selesai_masuk" varchar(8) NOT NULL,
	"mulai_pulang" varchar(8) NOT NULL,
	"selesai_pulang" varchar(8) NOT NULL,
	"kompensasi_waktu" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"longitude" double precision NOT NULL,
	"latitude" double precision NOT NULL,
	"distance" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perizinan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tanggal" timestamp with time zone DEFAULT now() NOT NULL,
	"kategori_izin" text NOT NULL,
	"deskripsi" text,
	"link_foto" text,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"status" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"rejected_at" timestamp with time zone,
	"rejected_by" text,
	"tanggal_utc_date" date
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nis" text,
	"full_name" text,
	"email" text,
	"avatar_url" text,
	"absence_number" text,
	"class_name" text,
	"gender" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_id_unique" ON "user_profiles" USING btree ("user_id");