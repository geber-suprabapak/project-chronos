import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import { ChangePasswordForm } from "~/components/change-password-form";

function readMustChangePasswordFlag(user: {
  user_metadata?: Record<string, unknown> | null;
}) {
  const value = user.user_metadata?.must_change_password;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

export default async function ChangePasswordPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!readMustChangePasswordFlag(user)) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Ganti Password Pertama</h1>
          <p className="text-muted-foreground text-sm">
            Demi keamanan akun, ubah password default sebelum melanjutkan.
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
