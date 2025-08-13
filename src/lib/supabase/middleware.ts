import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "~/env.js";

export function createSupabaseMiddlewareClient(request: NextRequest) {
	const response = NextResponse.next({ request: { headers: request.headers } });
	const supabase = createServerClient(
		env.NEXT_PUBLIC_SUPABASE_URL,
		env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll() {
					return request.cookies
						.getAll()
						.map((c) => ({ name: c.name, value: c.value }));
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach((c) => {
						response.cookies.set({ name: c.name, value: c.value, ...c.options });
					});
				},
			},
		},
	);
	return { supabase, response } as { supabase: SupabaseClient; response: NextResponse };
}

export type { SupabaseClient };
