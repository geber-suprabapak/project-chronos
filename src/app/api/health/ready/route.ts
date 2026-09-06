import { NextResponse } from "next/server";

const READINESS_TIMEOUT_MS = 3_000;

async function dependencyIsReady(baseUrl: string, path = ""): Promise<boolean> {
  try {
    const url = path
      ? new URL(path, baseUrl).toString()
      : new URL(baseUrl).toString();
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(READINESS_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const astraBaseUrl =
      process.env["ASTRA_API_URL"] ?? "http://localhost:3000";
    const logtoBaseUrl =
      process.env["LOGTO_ENDPOINT"] ?? "http://localhost:3001";
    const [astra, logto] = await Promise.all([
      dependencyIsReady(astraBaseUrl, "/ready"),
      dependencyIsReady(logtoBaseUrl, "/oidc/.well-known/openid-configuration"),
    ]);
    const ready = astra && logto;

    return NextResponse.json(
      {
        status: ready ? "ok" : "degraded",
        dependencies: { astra, logto },
      },
      {
        status: ready ? 200 : 503,
        headers: {
          "x-chronos-version": process.env.CHRONOS_APP_VERSION ?? "0.1.0",
          "x-chronos-revision": process.env.CHRONOS_COMMIT_SHA ?? "unknown",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        dependencies: { astra: false, logto: false },
      },
      {
        status: 503,
        headers: {
          "x-chronos-version": process.env.CHRONOS_APP_VERSION ?? "0.1.0",
          "x-chronos-revision": process.env.CHRONOS_COMMIT_SHA ?? "unknown",
        },
      },
    );
  }
}
