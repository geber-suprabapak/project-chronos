import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      headers: {
        "x-chronos-version": process.env.CHRONOS_APP_VERSION ?? "0.1.0",
        "x-chronos-revision": process.env.CHRONOS_COMMIT_SHA ?? "unknown",
      },
    },
  );
}
