"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "~/env.js";

// If you have generated types from your Supabase project, import them here:
// import type { Database } from "~/lib/database.types";
// Then change SupabaseClient below to SupabaseClient<Database>.

let browserClient: SupabaseClient | null = null;

/**
 * Returns a (cached) Supabase browser client for use inside React Client Components.
 * Safe to call in event handlers or during render in client components.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  browserClient ??= createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}

export type { SupabaseClient };
