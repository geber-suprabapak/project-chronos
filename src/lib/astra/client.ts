import { getAccessTokenRSC } from "@logto/next/server-actions";
import { env } from "~/env.js";
import { logtoConfig } from "~/lib/logto/config";

export class AstraRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AstraRequestError";
  }
}

type AstraEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: { message?: string };
};

export async function astraRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  // This client is also used while rendering Server Components through the
  // server-side tRPC caller. The RSC variant deliberately does not persist a
  // refreshed token cookie, which Next.js forbids during render.
  const token = await getAccessTokenRSC(logtoConfig, env.LOGTO_RESOURCE);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  headers.set("X-Astra-Contract-Version", "v1");
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");

  const response = await fetch(`${env.ASTRA_API_URL}${path}`, {
    ...init,
    headers,
  });
  if (response.headers.get("X-Astra-Contract-Version") !== "v1") {
    throw new AstraRequestError(
      "Astra contract version is unavailable or incompatible.",
      502,
    );
  }
  // SAFETY: Astra contract header v1 was verified immediately before decoding.
  const envelope = (await response
    .json()
    .catch(() => null)) as AstraEnvelope<T> | null;
  if (!response.ok || !envelope?.success) {
    throw new AstraRequestError(
      envelope?.error?.message ?? envelope?.message ?? "Astra request failed.",
      response.status,
    );
  }
  if (!("data" in envelope))
    throw new AstraRequestError("Astra response omitted data.", 502);
  // SAFETY: The success envelope has a data property after the contract guard.
  return envelope.data as T;
}
