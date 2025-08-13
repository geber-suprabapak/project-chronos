"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";

export function LogoutButton() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    startTransition(() => {
      router.replace("/login");
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} disabled={loading || isPending}>
      {loading ? "Logging out..." : "Logout"}
    </Button>
  );
}
