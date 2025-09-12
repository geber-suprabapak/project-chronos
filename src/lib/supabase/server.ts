import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "~/env.js";

export function createSupabaseServerClient() {
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        async getAll() {
          const store = await cookies();
          return store.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
      },
    },
  );
}

export type { SupabaseClient };
