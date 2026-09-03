import { getLogtoContext } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import { logtoConfig } from "~/lib/logto/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getLogtoContext(logtoConfig);
  return NextResponse.json(context);
}
