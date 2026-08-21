import { getAccessToken, getLogtoContext } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import { env } from "~/env.js";
import { logtoConfig } from "~/lib/logto/config";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const context = await getLogtoContext(logtoConfig);
  if (!context.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (entry.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 5MB limit." },
      { status: 413 },
    );
  }

  const accessToken = await getAccessToken(logtoConfig, env.LOGTO_RESOURCE);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Astra-Contract-Version": "v1",
  };
  const intentResponse = await fetch(
    `${env.ASTRA_API_URL}/v1/mobile/files/upload-intent`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        purpose: "permit_attachment",
        content_type: entry.type || "application/octet-stream",
        size_bytes: entry.size,
        filename: entry.name,
      }),
    },
  );
  if (!intentResponse.ok) {
    return NextResponse.json(
      { error: "Upload intent could not be created." },
      { status: intentResponse.status },
    );
  }

  // SAFETY: Astra returned a successful upload-intent envelope; required fields are checked below.
  const intentEnvelope = (await intentResponse.json()) as {
    data?: { file_id?: string; upload_url?: string };
  };
  const fileId = intentEnvelope.data?.file_id;
  const uploadUrl = intentEnvelope.data?.upload_url;
  if (!fileId || !uploadUrl) {
    return NextResponse.json(
      { error: "Upload contract returned an invalid intent." },
      { status: 502 },
    );
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": entry.type || "application/octet-stream" },
    body: entry,
  });
  if (!uploadResponse.ok) {
    return NextResponse.json({ error: "File upload failed." }, { status: 502 });
  }

  const confirmResponse = await fetch(
    `${env.ASTRA_API_URL}/v1/mobile/files/${encodeURIComponent(fileId)}/confirm`,
    {
      method: "POST",
      headers,
    },
  );
  if (!confirmResponse.ok) {
    return NextResponse.json(
      { error: "File upload confirmation failed." },
      { status: 502 },
    );
  }

  return NextResponse.json({ file_id: fileId });
}
