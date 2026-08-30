import { z } from "zod";

type ListEnvelope<Row> = {
  data?: readonly Row[] | null;
  items?: readonly Row[] | null;
  results?: readonly Row[] | null;
  rows?: readonly Row[] | null;
};

type ListSource<Row> = readonly Row[] | ListEnvelope<Row> | null | undefined;

type ClassNameFields = {
  name?: string | null;
  class_name?: string | null;
  className?: string | null;
  nama?: string | null;
  kelas?: string | null;
};

type StudentFields = ClassNameFields & {
  user_id?: string | null;
  userId?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  email?: string | null;
  nis?: string | null;
  absence_number?: string | null;
  absenceNumber?: string | null;
  absen?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  lifecycle_status?: string | null;
  lifecycleStatus?: string | null;
  gender?: string | null;
  kelamin?: string | null;
};

export type ClassNameSource = ListSource<ClassNameFields>;
export type StudentSource = ListSource<StudentFields>;

export type NormalizedStudent = {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  nis?: string | null;
  class_name?: string | null;
  absence_number?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  lifecycle_status?: string | null;
  gender?: string | null;
};

const nonEmptyStringSchema = z.string().trim().min(1);

const classNameRowSchema = z.object({
  name: z.string().nullable().optional(),
  class_name: z.string().nullable().optional(),
  className: z.string().nullable().optional(),
  nama: z.string().nullable().optional(),
  kelas: z.string().nullable().optional(),
});

const studentRowSchema = classNameRowSchema.extend({
  user_id: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  nis: z.string().nullable().optional(),
  absence_number: z.string().nullable().optional(),
  absenceNumber: z.string().nullable().optional(),
  absen: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  lifecycle_status: z.string().nullable().optional(),
  lifecycleStatus: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  kelamin: z.string().nullable().optional(),
});

function isRowList<Row>(value: ListSource<Row>): value is readonly Row[] {
  return Array.isArray(value);
}

function unwrapRows<Row>(value: ListSource<Row>): readonly Row[] {
  if (isRowList(value)) return value;
  if (value === null || value === undefined) return [];
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.rows)) return value.rows;
  return [];
}

function readClassName(value: ClassNameFields): string | null {
  const parsed = classNameRowSchema.safeParse(value);
  if (!parsed.success) return null;

  for (const candidate of [
    parsed.data.name,
    parsed.data.class_name,
    parsed.data.className,
    parsed.data.nama,
    parsed.data.kelas,
  ]) {
    const nonEmpty = nonEmptyStringSchema.safeParse(candidate);
    if (nonEmpty.success) return nonEmpty.data;
  }
  return null;
}

/** Collect class labels from the supported Astra list response shapes. */
export function collectUniqueClassNames(
  ...sources: ClassNameSource[]
): string[] {
  const unique = new Set<string>();
  for (const source of sources) {
    for (const row of unwrapRows(source)) {
      const name = readClassName(row);
      if (name) unique.add(name);
    }
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

function readOptionalString(
  source: StudentFields,
  keys: readonly (keyof StudentFields)[],
): string | null {
  for (const key of keys) {
    const parsed = nonEmptyStringSchema.safeParse(source[key]);
    if (parsed.success) return parsed.data;
  }
  return null;
}

/** Normalize profile rows so filters work with legacy camel-case payloads too. */
export function normalizeStudentRows(
  value: StudentSource,
): NormalizedStudent[] {
  return unwrapRows(value).flatMap((row) => {
    const parsed = studentRowSchema.safeParse(row);
    if (!parsed.success) return [];

    const source = parsed.data;
    const userId = nonEmptyStringSchema.safeParse(
      source.user_id ?? source.userId,
    );
    if (!userId.success) return [];

    return [
      {
        user_id: userId.data,
        full_name: readOptionalString(source, [
          "full_name",
          "fullName",
          "nama",
        ]),
        email: readOptionalString(source, ["email"]),
        nis: readOptionalString(source, ["nis"]),
        class_name: readOptionalString(source, [
          "class_name",
          "className",
          "kelas",
        ]),
        absence_number: readOptionalString(source, [
          "absence_number",
          "absenceNumber",
          "absen",
        ]),
        avatar_url: readOptionalString(source, ["avatar_url", "avatarUrl"]),
        role: readOptionalString(source, ["role"]),
        lifecycle_status: readOptionalString(source, [
          "lifecycle_status",
          "lifecycleStatus",
        ]),
        gender: readOptionalString(source, ["gender", "kelamin"]),
      },
    ];
  });
}
