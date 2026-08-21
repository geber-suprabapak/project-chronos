import { redirect } from "next/navigation";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
} from "~/lib/logto/claims";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import { ChangePasswordForm } from "~/components/change-password-form";

type UserWithPasswordMeta = {
  readonly user_metadata?: {
    readonly must_change_password?: boolean | string | number | null;
  } | null;
};

function readMustChangePasswordFlag(user: UserWithPasswordMeta): boolean {
  const value = user.user_metadata?.must_change_password;
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

export default async function ChangePasswordPage() {
  try {
    const logtoContext = await getLogtoContext(logtoConfig, {
      fetchUserInfo: true,
    });

    if (logtoContext.isAuthenticated && logtoContext.claims) {
      const claims = extractExtendedClaims(logtoContext.claims);
      if (!isPasswordChangeRequired(claims)) {
        redirect("/dashboard");
      }
    } else {
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
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
      throw err;
    }
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
