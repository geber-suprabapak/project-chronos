import { logtoConfig } from "../../lib/logto/config.ts";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  resolveLogtoRole,
} from "../../lib/logto/claims.ts";
import { type AppRole, canUploadFiles } from "./rbac.ts";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB

export const ALLOWED_MIME_TO_EXTENSIONS = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/jpg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
} as const satisfies Record<string, readonly string[]>;

export type AllowedMimeType = keyof typeof ALLOWED_MIME_TO_EXTENSIONS;

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return value in ALLOWED_MIME_TO_EXTENSIONS;
}

export const ALLOWED_FILE_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

export const ALLOWED_FILE_EXTENSIONS = new Set<string>([
  ".jpg",
  ".jpeg",
  ".png",
  ".pdf",
]);

function jsonError(error: string, status: number, requestId: string): Response {
  return Response.json(
    { error, request_id: requestId },
    { status, headers: { "X-Request-ID": requestId } },
  );
}

export type FileUploadAccessResult =
  | {
      ok: true;
      role: AppRole;
      requestId: string;
    }
  | {
      ok: false;
      response: Response;
    };

/**
 * Validates whether an incoming request satisfies file proxy RBAC policies:
 * - Authenticated via Logto
 * - Password change not required
 * - Privileged role (platform_admin, school_admin, teacher, staff, or legacy aliases)
 */
export async function requireFileUploadAccess(
  requestId: string,
): Promise<FileUploadAccessResult> {
  try {
    const { getLogtoContext } = await import("@logto/next/server-actions");
    const logtoContext = await getLogtoContext(logtoConfig);

    if (!logtoContext.isAuthenticated || !logtoContext.claims) {
      return {
        ok: false,
        response: jsonError("Unauthorized", 401, requestId),
      };
    }

    const claims = extractExtendedClaims(logtoContext.claims);
    if (isPasswordChangeRequired(claims)) {
      return {
        ok: false,
        response: jsonError("Password change required", 403, requestId),
      };
    }

    const role = resolveLogtoRole(claims?.roles ?? []);
    if (!canUploadFiles(role)) {
      return {
        ok: false,
        response: jsonError("Forbidden", 403, requestId),
      };
    }

    return { ok: true, role, requestId };
  } catch {
    return {
      ok: false,
      response: jsonError("Unauthorized", 401, requestId),
    };
  }
}

export type FileValidationResult =
  | { ok: true; file: File }
  | {
      ok: false;
      response: Response;
    };

/**
 * Validates that the uploaded entry is a valid File matching:
 * - Presence (instance of File)
 * - Size <= 5MiB
 * - MIME type & extension in JPEG, PNG, PDF
 */
export function validateUploadedFile(
  entry: FormDataEntryValue | null,
  requestId: string,
): FileValidationResult {
  if (!(entry instanceof File)) {
    return {
      ok: false,
      response: jsonError("A file is required.", 400, requestId),
    };
  }

  if (entry.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      response: jsonError("File exceeds the 5MB limit.", 413, requestId),
    };
  }

  const mimeType = entry.type.toLowerCase().trim();
  if (
    !mimeType ||
    mimeType === "application/octet-stream" ||
    !isAllowedMimeType(mimeType)
  ) {
    return {
      ok: false,
      response: jsonError(
        "Unsupported file type. Only JPEG, PNG, and PDF files are allowed.",
        400,
        requestId,
      ),
    };
  }

  const allowedExtensions: readonly string[] =
    ALLOWED_MIME_TO_EXTENSIONS[mimeType];
  const lowerName = entry.name.toLowerCase();
  const hasCompatibleExtension = allowedExtensions.some((ext) =>
    lowerName.endsWith(ext),
  );

  if (!hasCompatibleExtension) {
    return {
      ok: false,
      response: jsonError(
        "Unsupported file type. Only JPEG, PNG, and PDF files are allowed.",
        400,
        requestId,
      ),
    };
  }

  return { ok: true, file: entry };
}
