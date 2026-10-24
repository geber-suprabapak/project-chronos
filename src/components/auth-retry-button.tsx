"use client";

import { Button } from "~/components/ui/button";

/**
 * Client retry control for the application-owned identity-degraded state
 * (`/auth/unavailable`, C09). Reloading the original target re-runs the
 * identity check in the middleware; when the provider has recovered the user
 * continues into the portal without a fresh sign-in, and when the session is
 * genuinely gone they land on the existing `/login` route.
 */
export function AuthRetryButton({ target }: { target: string }) {
  return (
    <Button
      type="button"
      className="w-full font-medium"
      onClick={() => {
        window.location.href = target;
      }}
    >
      Coba lagi
    </Button>
  );
}
