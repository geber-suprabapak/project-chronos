import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "~/lib/supabase/server";

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
