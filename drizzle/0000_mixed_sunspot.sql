CREATE TABLE "absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"reason" text,
	"photo_url" text,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perizinan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kategori_izin" text NOT NULL,
	"deskripsi" text NOT NULL,
	"status" boolean DEFAULT false NOT NULL,
	"link_foto" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"tanggal" timestamp with time zone NOT NULL,
	"tanggal_utc_date" date,
	"approval_status" text DEFAULT 'pending',
	"rejected_at" timestamp with time zone,
	"rejected_by" text
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nis" text,
	"full_name" text,
	"email" text NOT NULL,
	"avatar_url" text,
	"absence_number" text,
	"class_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user'
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_email_unique" ON "user_profiles" USING btree ("email");