"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "~/lib/utils";
import { extractRoleFromAccessToken } from "~/lib/jwt";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";

const ALLOWED_ROLES = new Set([
  "platform_admin",
  "school_admin",
  "teacher",
  "staff",
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
]);

type MetadataWithPasswordFlag = {
  readonly must_change_password?: boolean | string | number | null;
};

function readMustChangePasswordFlag(
  metadata: MetadataWithPasswordFlag | null | undefined,
): boolean {
  const value = metadata?.must_change_password;
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

const ERROR_MESSAGES = {
  mfa_required:
    "Autentikasi Multi-Faktor (MFA) wajib untuk akun administrator. Harap verifikasi MFA Anda.",
  forbidden_role:
    "Akun Anda tidak memiliki hak akses istimewa untuk masuk ke portal Chronos.",
  unauthorized: "Sesi tidak valid atau telah berakhir. Silakan login kembali.",
  invalid_credentials: "Email atau password tidak valid.",
} as const satisfies Record<string, string>;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam && errorParam in ERROR_MESSAGES) {
      // SAFETY: errorParam in ERROR_MESSAGES confirms it is a key of ERROR_MESSAGES
      const message = ERROR_MESSAGES[errorParam as keyof typeof ERROR_MESSAGES];
      setError(message);
    }
  }, [searchParams]);

  function handleLogtoSignIn() {
    setIsLoading(true);
    window.location.href = "/api/logto/sign-in";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email,
          password,
        },
      );

      if (authError) {
        setError("Invalid credentials.");
        return;
      }

      // Extract role from access token (authoritative source after custom hook)
      const role = extractRoleFromAccessToken(
        data.session?.access_token ?? null,
      );

      if (!role || !ALLOWED_ROLES.has(role)) {
        await supabase.auth.signOut();
        setError("Invalid credentials.");
        return;
      }

      if (readMustChangePasswordFlag(data.user?.user_metadata)) {
        router.replace("/ganti-password");
        return;
      }

      router.replace("/dashboard");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6">
            <Button
              type="button"
              variant="default"
              className="w-full font-medium"
              disabled={isLoading}
              onClick={handleLogtoSignIn}
            >
              {isLoading
                ? "Mengalihkan..."
                : "Masuk dengan Akun Skanida (Logto)"}
            </Button>

            <div className="relative flex items-center justify-center">
              <div className="border-border absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <span className="bg-card text-muted-foreground relative px-2 text-xs uppercase">
                Atau login manual
              </span>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
