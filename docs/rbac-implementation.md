# RBAC implementation (Chronos)

## Authority boundaries

Chronos uses Logto's built-in RBAC. Role assignment is made in Logto; the
application does not mint, transform, or trust a locally generated role claim.

- Logto global roles are the source of truth for who may use the Chronos
  administrative UI.
- The Chronos callback reads the standard `roles` claim issued by Logto. It
  admits only the configured privileged roles and redirects other users away
  from the dashboard.
- Astra is the API authority. Chronos requests an Astra resource token and
  Astra authorizes each request from Logto resource scopes, not from a Chronos
  role check.

This keeps UI admission and API authorization explicit, while retaining a
single authority for role-to-permission assignment: Logto.

## Roles and permissions

The Logto tenant currently defines `student`, `teacher`, `staff`,
`school_admin`, and `platform_admin`. Legacy aliases remain accepted only while
older migrated accounts are being normalized.

The Astra resource is `https://api.lunaradev.my.id/skanida`. Chronos requests
the following permissions for that resource:

- `mobile:access`
- `admin:read`
- `files:read:any`
- `files:delete:any`

Logto issues only the permissions granted through the authenticated user's
assigned roles. Astra verifies the issuer, audience, signature, and required
scope before handling the request.

## MFA and password changes

Chronos no longer requires an application-specific `mfa_verified` JWT claim.
Any MFA policy is configured and enforced in Logto interaction/sign-in policy.
Chronos may still redirect a user whose Logto custom data declares a required
password change; that is an account-lifecycle action, not authorization.

## Deployment and verification

1. Configure the Astra API resource, scopes, and global roles in Logto.
2. Assign roles in Logto; do not add a Supabase custom access-token hook.
3. Set `LOGTO_RESOURCE` to the exact Astra resource identifier.
4. Register the exact `/api/logto/callback` redirect URI for the Chronos app.
5. Login with a role-bearing test user and confirm it reaches `/dashboard`.
6. Call a protected Astra route and confirm a resource token is accepted only
   when Logto granted its required scope.

## Rollback

Revert the Chronos deployment and preserve the Logto role assignments. Do not
restore the retired Supabase custom-access-token hook as part of this rollback;
it is not part of the Logto authorization boundary.
