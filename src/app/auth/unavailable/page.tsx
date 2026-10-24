import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { AuthRetryButton } from "~/components/auth-retry-button";
import { LOGTO_OUTCOME_MESSAGES } from "~/lib/logto/outcome";

/**
 * Application-owned degraded state for the shared Logto boundary (C09).
 *
 * Rendered at the public route `/auth/unavailable` whenever the identity
 * provider fails (non-OK, malformed, timeout/network) while resolving the
 * authenticated shell. This state is deliberately NOT the `/login` route: an
 * identity-provider outage must never be presented as an expired session.
 * It never names the provider, its endpoints, or any upstream status.
 */

/** Only same-origin absolute paths are accepted as retry targets. */
export function sanitizeRetryTarget(raw: string | undefined): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/dashboard";
}

export const metadata = {
  title: "Layanan autentikasi tidak tersedia",
};

export default async function AuthUnavailablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawFrom = Array.isArray(params.from) ? params.from[0] : params.from;
  const target = sanitizeRetryTarget(rawFrom);

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Layanan autentikasi tidak tersedia</CardTitle>
          <CardDescription>
            Portal Chronos tidak dapat memverifikasi sesi Anda saat ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground" role="alert">
            {LOGTO_OUTCOME_MESSAGES.degraded}
          </p>
          <AuthRetryButton target={target} />
          <p className="text-center text-sm">
            <Link
              href="/login"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Kembali ke halaman masuk
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
