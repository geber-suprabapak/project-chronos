import type { LogtoNextConfig } from "@logto/next";
import { UserScope } from "@logto/next";
import { env } from "../../env.js";

const DEV_DEFAULT_APP_SECRET = "chronos-secret-key-at-least-32-chars";
const DEV_DEFAULT_COOKIE_SECRET =
  "complex_password_at_least_32_characters_long_12345";

function resolveLogtoSecret(
  value: string | undefined,
  devFallback: string,
  envName: string,
): string {
  const isProdRuntime =
    env.NODE_ENV === "production" && !process.env["SKIP_ENV_VALIDATION"];

  if (value && (!isProdRuntime || value !== devFallback)) {
    return value;
  }

  if (!isProdRuntime) {
    return devFallback;
  }

  throw new Error(
    `${envName} must be configured with a non-default secret in production.`,
  );
}

export const logtoConfig: LogtoNextConfig = {
  endpoint: env.LOGTO_ENDPOINT ?? "http://localhost:3001",
  appId: env.LOGTO_APP_ID ?? "chronos-app",
  appSecret: resolveLogtoSecret(
    env.LOGTO_APP_SECRET,
    DEV_DEFAULT_APP_SECRET,
    "LOGTO_APP_SECRET",
  ),
  baseUrl: env.LOGTO_BASE_URL ?? "http://localhost:3000",
  cookieSecret: resolveLogtoSecret(
    env.LOGTO_COOKIE_SECRET,
    DEV_DEFAULT_COOKIE_SECRET,
    "LOGTO_COOKIE_SECRET",
  ),
  // Produksi tetap default Secure; staging k8s over HTTP menonaktifkannya
  // eksplisit via LOGTO_COOKIE_SECURE=false.
  cookieSecure:
    env.NODE_ENV === "production" &&
    process.env.LOGTO_COOKIE_SECURE !== "false",
  scopes: [
    UserScope.Profile,
    UserScope.Email,
    UserScope.Roles,
    UserScope.CustomData,
    // These are permissions on the Astra API resource. Logto only grants the
    // subset assigned through the authenticated user's global roles.
    "mobile:access",
    "admin:read",
    "files:read:any",
    "files:delete:any",
  ],
  resources: env.LOGTO_RESOURCE ? [env.LOGTO_RESOURCE] : undefined,
};
