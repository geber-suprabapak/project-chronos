"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "~/lib/utils";
import { extractRoleFromAccessToken } from "~/lib/jwt";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";

const ALLOWED_ROLES = new Set([
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

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-3">
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
            <div className="grid gap-3">
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
