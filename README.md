# Skanida Chronos

Portal web administrasi sekolah untuk data siswa dan profil, absensi, perizinan, lokasi, jadwal, serta ekspor operasional. Chronos memakai Logto untuk identitas/peran dan Astra sebagai otoritas API serta state domain; repository ini tidak memiliki database domain sendiri.

## Local development

Prerequisite: Node.js 22 dan pnpm 10.15.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Environment yang diperlukan didokumentasikan di `.env.example`. Jangan menyalin secret produksi ke repository atau fixture test.

## Quality gates

```bash
pnpm check
pnpm test
pnpm build
pnpm test:e2e
```

E2E menyalakan mock Astra dan Logto melalui `e2e/fixtures/start-servers.ts`; test write-path tidak boleh diarahkan ke produksi.

## Architecture and product context

- `PRODUCT.md` — tujuan, pengguna, batas produk, dan prinsip settlement.
- `DESIGN.md` — bahasa desain dan guardrail UI/UX Chronos.
- `docs/codebase-map/` — peta modul, flow, invariant, dan decision index.
- `docs/rbac-implementation.md` — authority boundary Logto dan Astra.
- `contracts/astra-v1.json` — snapshot kontrak integrasi; harus tetap sinkron dengan Astra.

## Deployment

Image standalone Next.js dibangun oleh `Dockerfile`. Workflow `.github/workflows/buildtest.yml` menerbitkan image GHCR. Deployment produksi dan perubahan shared infrastructure harus mengikuti runbook workspace dan safety gate; status container sehat saja tidak cukup sebagai verifikasi end-to-end.
