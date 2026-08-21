import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z
      .string()
      .url()
      .default("postgresql://postgres:postgres@localhost:5432/chronos"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    LOGTO_ENDPOINT: z.string().url().default("http://localhost:3001"),
    LOGTO_APP_ID: z.string().min(1).default("chronos-app"),
    LOGTO_APP_SECRET: z
      .string()
      .min(1)
      .default("chronos-secret-key-at-least-32-chars"),
    LOGTO_COOKIE_SECRET: z
      .string()
      .min(32)
      .default("complex_password_at_least_32_characters_long_12345"),
    LOGTO_BASE_URL: z.string().url().default("http://localhost:3000"),
    LOGTO_RESOURCE: z.string().optional(),
    ASTRA_API_URL: z.string().url().default("http://localhost:8787"),
    LOGTO_MANAGEMENT_APP_ID: z.string().min(1).optional(),
    LOGTO_MANAGEMENT_APP_SECRET: z.string().min(1).optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {},

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    LOGTO_ENDPOINT: process.env.LOGTO_ENDPOINT,
    LOGTO_APP_ID: process.env.LOGTO_APP_ID,
    LOGTO_APP_SECRET: process.env.LOGTO_APP_SECRET,
    LOGTO_COOKIE_SECRET: process.env.LOGTO_COOKIE_SECRET,
    LOGTO_BASE_URL: process.env.LOGTO_BASE_URL,
    LOGTO_RESOURCE: process.env.LOGTO_RESOURCE,
    ASTRA_API_URL: process.env.ASTRA_API_URL,
    LOGTO_MANAGEMENT_APP_ID: process.env.LOGTO_MANAGEMENT_APP_ID,
    LOGTO_MANAGEMENT_APP_SECRET: process.env.LOGTO_MANAGEMENT_APP_SECRET,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
