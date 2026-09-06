import { getAccessToken } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import { env } from "~/env.js";
import {
  buildAstraContractHeaders,
  createAstraRequestId,
  getAstraResponseRequestId,
} from "~/lib/astra/request-id";
import { logtoConfig } from "~/lib/logto/config";
import {
  requireFileUploadAccess,
  validateUploadedFile,
} from "~/server/auth/file-guard";
import { writeOperationalEvent } from "~/lib/observability";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));
  const access = await requireFileUploadAccess(requestId);
  if (!access.ok) {
    return access.response;
  }

  const form = await request.formData();
  const validation = validateUploadedFile(form.get("file"), requestId);
  if (!validation.ok) {
    return validation.response;
  }
  const entry = validation.file;

  try {
    const accessToken = await getAccessToken(logtoConfig, env.LOGTO_RESOURCE);
    const { headers } = buildAstraContractHeaders(
      {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      requestId,
    );
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
    const intentRequestId = getAstraResponseRequestId(
      intentResponse,
      requestId,
    );
    if (
      !intentResponse.ok ||
      intentResponse.headers.get("X-Astra-Contract-Version") !== "v1"
    ) {
      const status = intentResponse.ok ? 502 : intentResponse.status;
      writeOperationalEvent({
        event: "upload.error",
        outcome: "failure",
        requestId: intentRequestId,
        path: "/api/astra/files",
        status,
        error: "Upload intent contract is unavailable or incompatible.",
      });
      return NextResponse.json(
        {
          error: "Upload intent contract is unavailable or incompatible.",
          request_id: intentRequestId,
        },
        {
          status,
          headers: { "X-Request-ID": intentRequestId },
        },
      );
    }

    // SAFETY: Astra returned a successful upload-intent envelope; required fields are checked below.
    const intentEnvelope = (await intentResponse.json()) as {
      data?: { file_id?: string; upload_url?: string };
    };
    const fileId = intentEnvelope.data?.file_id;
    const uploadUrl = intentEnvelope.data?.upload_url;
    if (!fileId || !uploadUrl) {
      writeOperationalEvent({
        event: "upload.error",
        outcome: "failure",
        requestId: intentRequestId,
        path: "/api/astra/files",
        status: 502,
        error: "Upload contract returned an invalid intent.",
      });
      return NextResponse.json(
        {
          error: "Upload contract returned an invalid intent.",
          request_id: intentRequestId,
        },
        { status: 502, headers: { "X-Request-ID": intentRequestId } },
      );
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": entry.type || "application/octet-stream" },
      body: entry,
    });
    if (!uploadResponse.ok) {
      writeOperationalEvent({
        event: "upload.error",
        outcome: "failure",
        requestId: intentRequestId,
        path: "/api/astra/files",
        status: 502,
        error: "File upload failed.",
      });
      return NextResponse.json(
        { error: "File upload failed.", request_id: intentRequestId },
        { status: 502, headers: { "X-Request-ID": intentRequestId } },
      );
    }

    const confirmResponse = await fetch(
      `${env.ASTRA_API_URL}/v1/mobile/files/${encodeURIComponent(fileId)}/confirm`,
      {
        method: "POST",
        headers: buildAstraContractHeaders(
          {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          intentRequestId,
        ).headers,
      },
    );
    const confirmRequestId = getAstraResponseRequestId(
      confirmResponse,
      intentRequestId,
    );
    if (
      !confirmResponse.ok ||
      confirmResponse.headers.get("X-Astra-Contract-Version") !== "v1"
    ) {
      const status = confirmResponse.ok ? 502 : confirmResponse.status;
      writeOperationalEvent({
        event: "upload.error",
        outcome: "failure",
        requestId: confirmRequestId,
        path: "/api/astra/files",
        status,
        error: "File upload contract is unavailable or incompatible.",
      });
      return NextResponse.json(
        {
          error: "File upload contract is unavailable or incompatible.",
          request_id: confirmRequestId,
        },
        {
          status,
          headers: { "X-Request-ID": confirmRequestId },
        },
      );
    }
    // SAFETY: Astra returned a successful confirmation envelope containing a FileRecord.
    const confirmation = (await confirmResponse.json()) as {
      data?: {
        id?: string;
        object_path?: string;
        download_url?: string | null;
      };
    };

    return NextResponse.json(
      {
        file_id: confirmation.data?.id ?? fileId,
        url: confirmation.data?.object_path ?? confirmation.data?.id ?? fileId,
        request_id: confirmRequestId,
      },
      { headers: { "X-Request-ID": confirmRequestId } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengunggah berkas";
    writeOperationalEvent({
      event: "upload.error",
      outcome: "failure",
      requestId,
      path: "/api/astra/files",
      status: 500,
      error: message,
    });
    return NextResponse.json(
      { error: message, request_id: requestId },
      { status: 500, headers: { "X-Request-ID": requestId } },
    );
  }
}
