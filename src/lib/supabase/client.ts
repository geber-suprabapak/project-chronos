"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
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

/**
 * React hook to get the current authenticated user
 * Use this in client components to access user data and check auth status
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    
    // Get initial user state
    const getUser = async () => {
      const { data: { user } } = await client.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    
    void getUser();
    
    // Set up auth state listener
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export type { SupabaseClient, User };
