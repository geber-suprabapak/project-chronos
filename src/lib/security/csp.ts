export function buildContentSecurityPolicy(storagePublicUrl: string): string {
  const storage = new URL(storagePublicUrl);
  if (
    !["http:", "https:"].includes(storage.protocol) ||
    storage.username ||
    storage.password
  ) {
    throw new Error(
      "STORAGE_PUBLIC_URL must be an HTTP(S) URL without credentials.",
    );
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com ${storage.origin}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.tile.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
