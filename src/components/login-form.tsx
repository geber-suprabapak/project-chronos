"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

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
  const searchParams = useSearchParams();
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
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
