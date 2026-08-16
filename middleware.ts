/**
 * Middleware global Next.js untuk menangani:
 *  - Inisialisasi Supabase (SSR) dan sinkronisasi cookie auth terbaru.
 *  - Proteksi route (redirect ke /login jika belum ada sesi).
 *  - Redirect pengguna yang sudah login agar tidak kembali ke /login.
 *
 * Alur singkat:
 *  1. Buat client Supabase khusus middleware (punya access ke cookies request/response).
 *  2. Ambil sesi aktif (jika ada).
 *  3. Jika user mengakses halaman publik → lewati.
 *  4. Jika user belum login & path privat → redirect ke /login?redirect=<path_asal>.
 *  5. Jika user sudah login tapi membuka /login → redirect ke beranda (/).
 *  6. Kembalikan response yang sudah diperkaya (cookie auth bisa ter-update).
 *
 * Menambahkan halaman publik baru: cukup tambahkan path absolut ke PUBLIC_PATHS
 * atau perluas logika di isPublicPath().
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "~/lib/supabase/middleware";

// Daftar path yang TIDAK membutuhkan autentikasi (akses bebas)
const PUBLIC_PATHS = new Set([
  "/login",
  "/ganti-password",
  "/auth/callback", // potential OAuth callback
]);

type UserWithPasswordMeta = {
  readonly user_metadata?: {
    readonly must_change_password?: boolean | string | number | null;
  } | null;
};

function readMustChangePasswordFlag(user: UserWithPasswordMeta): boolean {
  const value = user.user_metadata?.must_change_password;
  if (
    value === true ||
    value === 1 ||
    value === "true" ||
    value === "1" ||
    value === "yes"
  ) {
    return true;
  }
  return false;
}

/**
 * Menentukan apakah suatu pathname bersifat publik.
 * Sesuaikan sesuai kebutuhan (misal ingin mengamankan /api → ubah return untuk /api menjadi false).
 */
function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Aset statis & internal Next
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public")
  )
    return true;
  // API routes (saat ini dibiarkan publik — ubah jika perlu)
  if (pathname.startsWith("/api")) return true; // ubah ke false bila ingin proteksi API
  return false;
}

/**
 * Middleware utama: evaluasi sesi & lakukan redirect jika diperlukan.
 */
export async function middleware(req: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(req);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  const mustChangePassword = user ? readMustChangePasswordFlag(user) : false;

  // Jika user sudah login & membuka /login → kembalikan ke beranda
  if (pathname === "/login" && user) {
    const url = req.nextUrl.clone();
    url.pathname = mustChangePassword ? "/ganti-password" : "/";
    return NextResponse.redirect(url);
  }

  // Paksa user yang belum ganti password tetap di halaman ganti password.
  if (
    user &&
    mustChangePassword &&
    pathname !== "/ganti-password" &&
    !isPublicPath(pathname)
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/ganti-password";
    return NextResponse.redirect(url);
  }

  // Jika sudah tidak wajib ganti password, jangan biarkan masuk lagi ke halaman itu.
  if (user && !mustChangePassword && pathname === "/ganti-password") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response; // includes any updated auth cookies
}

export const config = {
  matcher: ["/(.*)"],
};
