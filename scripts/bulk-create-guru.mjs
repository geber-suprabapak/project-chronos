#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const VALID_ROLES = new Set([
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
]);

function printUsage() {
  console.log(`\nBulk create akun guru/staf Chronos\n\nUsage:\n  node scripts/bulk-create-guru.mjs --input <file.csv|file.json> [--output <output.csv>] [--role guru] [--dry-run]\n\nInput CSV header minimal:\n  email,full_name\n\nInput JSON minimal:\n  [{"email":"guru1@sekolah.sch.id","full_name":"Guru 1"}]\n\nEnvironment required:\n  NEXT_PUBLIC_SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY\n`);
}

function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
    role: "guru",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") {
      args.input = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--output") {
      args.output = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--role") {
      args.role = (argv[i + 1] ?? "").trim();
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return args;
}

function normalizeRole(role) {
  const normalized = role.trim().toLowerCase();
  if (!VALID_ROLES.has(normalized)) {
    throw new Error(
      `Role tidak valid: ${role}. Gunakan salah satu: ${Array.from(VALID_ROLES).join(", ")}`,
    );
  }
  return normalized;
}

function randomPassword(length = 14) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return result;
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((s) => s.trim().toLowerCase());
  return lines.slice(1).map((line, index) => {
    const cells = line.split(",").map((s) => s.trim());
    const row = {};

    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = cells[i] ?? "";
    }

    row.__line = String(index + 2);
    return row;
  });
}

function normalizeInputRow(row, fallbackRole) {
  const email = String(row.email ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(row.full_name ?? row.fullName ?? row.nama ?? "").trim();
  const role = row.role ? normalizeRole(String(row.role)) : fallbackRole;

  if (!email) throw new Error("email wajib diisi");
  if (!fullName) throw new Error("full_name wajib diisi");

  return { email, fullName, role };
}

function toCsvRow(values) {
  return values
    .map((value) => {
      const raw = String(value ?? "");
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replaceAll('"', '""')}"`;
    })
    .join(",");
}

async function readInputRecords(filePath, fallbackRole) {
  const content = await fs.readFile(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".json") {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error("Input JSON harus berupa array");
    }
    return parsed.map((row, index) => {
      try {
        return normalizeInputRow(row, fallbackRole);
      } catch (error) {
        throw new Error(`Baris JSON ke-${index + 1}: ${error.message}`);
      }
    });
  }

  const rows = parseCsv(content);
  return rows.map((row) => {
    try {
      return normalizeInputRow(row, fallbackRole);
    } catch (error) {
      const lineInfo = row.__line ? ` (baris ${row.__line})` : "";
      throw new Error(`CSV error${lineInfo}: ${error.message}`);
    }
  });
}

async function ensureOutputDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function upsertUserProfile(supabase, userId, profile) {
  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      full_name: profile.fullName,
      email: profile.email,
      role: profile.role,
    },
    {
      onConflict: "user_id",
    },
  );

  if (error) {
    throw new Error(`Gagal membuat user_profiles: ${error.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    printUsage();
    process.exit(1);
  }

  const role = normalizeRole(args.role);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Env wajib belum lengkap. Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const defaultOutput = path.resolve(
    process.cwd(),
    "scripts",
    "output",
    `bulk-guru-result-${timestamp}.csv`,
  );
  const outputPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : defaultOutput;

  const records = await readInputRecords(inputPath, role);

  if (records.length === 0) {
    throw new Error("Input kosong. Tidak ada akun yang diproses.");
  }

  const uniqueEmails = new Set();
  for (const row of records) {
    if (uniqueEmails.has(row.email)) {
      throw new Error(`Email duplikat pada input: ${row.email}`);
    }
    uniqueEmails.add(row.email);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`Total data diproses: ${records.length}`);
  console.log(`Mode: ${args.dryRun ? "DRY RUN" : "EXECUTE"}`);

  const rowsForOutput = [];
  let successCount = 0;

  for (const item of records) {
    const generatedPassword = randomPassword();

    if (args.dryRun) {
      rowsForOutput.push({
        email: item.email,
        fullName: item.fullName,
        role: item.role,
        password: generatedPassword,
        status: "dry-run",
        userId: "",
        error: "",
      });
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: item.email,
      password: generatedPassword,
      email_confirm: true,
      app_metadata: {
        role: item.role,
        roles: [item.role],
      },
      user_metadata: {
        full_name: item.fullName,
        must_change_password: true,
      },
    });

    if (error) {
      rowsForOutput.push({
        email: item.email,
        fullName: item.fullName,
        role: item.role,
        password: "",
        status: "failed",
        userId: "",
        error: error.message,
      });
      continue;
    }

    const userId = data.user?.id;

    if (!userId) {
      rowsForOutput.push({
        email: item.email,
        fullName: item.fullName,
        role: item.role,
        password: "",
        status: "failed",
        userId: "",
        error: "User berhasil dibuat tetapi tidak ada user_id yang dikembalikan.",
      });
      continue;
    }

    try {
      await upsertUserProfile(supabase, userId, item);
    } catch (profileError) {
      const rollbackResult = await supabase.auth.admin.deleteUser(userId);
      const rollbackMessage = rollbackResult.error
        ? ` Rollback auth user gagal: ${rollbackResult.error.message}`
        : " Auth user di-rollback.";

      rowsForOutput.push({
        email: item.email,
        fullName: item.fullName,
        role: item.role,
        password: "",
        status: "failed",
        userId,
        error: `${profileError instanceof Error ? profileError.message : String(profileError)}${rollbackMessage}`,
      });
      continue;
    }

    successCount += 1;
    rowsForOutput.push({
      email: item.email,
      fullName: item.fullName,
      role: item.role,
      password: generatedPassword,
      status: "created",
      userId,
      error: "",
    });
  }

  await ensureOutputDir(outputPath);

  const csvLines = [
    toCsvRow(["email", "full_name", "role", "password", "status", "user_id", "error"]),
    ...rowsForOutput.map((row) =>
      toCsvRow([
        row.email,
        row.fullName,
        row.role,
        row.password,
        row.status,
        row.userId,
        row.error,
      ]),
    ),
  ];

  await fs.writeFile(outputPath, `${csvLines.join("\n")}\n`, "utf8");

  console.log(`Selesai. Berhasil dibuat: ${successCount}/${records.length}`);
  console.log(`Output hasil: ${outputPath}`);
  console.log("Script ini langsung membuat auth user dan row user_profiles.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
