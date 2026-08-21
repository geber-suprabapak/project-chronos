import type { LogtoNextConfig } from "@logto/next";
import { UserScope } from "@logto/next";
import { env } from "../../env.js";

export const logtoConfig: LogtoNextConfig = {
  endpoint: env.LOGTO_ENDPOINT ?? "http://localhost:3001",
  appId: env.LOGTO_APP_ID ?? "chronos-app",
  appSecret: env.LOGTO_APP_SECRET ?? "chronos-secret-key-at-least-32-chars",
  baseUrl: env.LOGTO_BASE_URL ?? "http://localhost:3000",
  cookieSecret:
    env.LOGTO_COOKIE_SECRET ??
    "complex_password_at_least_32_characters_long_12345",
  cookieSecure: env.NODE_ENV === "production",
  scopes: [
    UserScope.Profile,
    UserScope.Email,
    UserScope.Roles,
    UserScope.CustomData,
  ],
  resources: env.LOGTO_RESOURCE ? [env.LOGTO_RESOURCE] : undefined,
};
