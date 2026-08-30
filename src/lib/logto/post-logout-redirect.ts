/**
 * Logto accepts post-logout redirects only when they are registered on the
 * application. Keep the destination configuration-only (never request input)
 * and constrain it to the Chronos application origin.
 */
export function getPostLogoutRedirectUri(
  baseUrl: string,
  configuredRedirectUri: string | undefined,
) {
  if (!configuredRedirectUri) {
    throw new Error(
      "LOGTO_POST_LOGOUT_REDIRECT_URI must be configured with a registered Logto post-sign-out redirect URI.",
    );
  }

  const applicationUrl = new URL(baseUrl);
  const redirectUrl = new URL(configuredRedirectUri);

  if (redirectUrl.origin !== applicationUrl.origin) {
    throw new Error(
      "LOGTO_POST_LOGOUT_REDIRECT_URI must use the Chronos application origin.",
    );
  }

  return redirectUrl.toString();
}
