import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runEnvCheck(extraEnv: Record<string, string | undefined>) {
  const cleanEnv: Record<string, string | undefined> = {
    ...process.env,
    SKIP_ENV_VALIDATION: undefined,
    LOGTO_APP_SECRET: undefined,
    LOGTO_COOKIE_SECRET: undefined,
    LOGTO_POST_LOGOUT_REDIRECT_URI: "https://chronos.example.sch.id/login",
    LOGTO_ENDPOINT: "https://auth.example.sch.id",
    LOGTO_APP_ID: "chronos-prod",
    LOGTO_BASE_URL: "https://chronos.example.sch.id",
    ASTRA_API_URL: "https://api.example.sch.id",
    ...extraEnv,
  };
  for (const key of Object.keys(cleanEnv)) {
    if (cleanEnv[key] === undefined) delete cleanEnv[key];
  }
  return spawnSync(process.execPath, ["-e", 'import("./src/env.js")'], {
    cwd: process.cwd(),
    env: cleanEnv as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
}

describe("Production secret validation (SEC-02)", () => {
  it("rejects missing Logto secrets when NODE_ENV=production", () => {
    const res = runEnvCheck({ NODE_ENV: "production" });
    assert.notEqual(res.status, 0);
  });

  it("rejects committed placeholder Logto secrets when NODE_ENV=production", () => {
    const res = runEnvCheck({
      NODE_ENV: "production",
      LOGTO_APP_SECRET: "chronos-secret-key-at-least-32-chars",
      LOGTO_COOKIE_SECRET: "complex_password_at_least_32_characters_long_12345",
    });
    assert.notEqual(res.status, 0);
  });

  it("accepts non-placeholder secrets when NODE_ENV=production", () => {
    const res = runEnvCheck({
      NODE_ENV: "production",
      LOGTO_APP_SECRET: "prod-app-secret-value-unique",
      LOGTO_COOKIE_SECRET: "prod_cookie_secret_at_least_32_characters_long",
    });
    assert.equal(res.status, 0);
  });
});
