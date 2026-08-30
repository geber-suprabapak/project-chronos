import {
  test as base,
  expect,
  type Page,
  type BrowserContext,
} from "@playwright/test";

export interface MockUserOptions {
  sub?: string;
  email?: string;
  name?: string;
  roles?: string[];
  must_change_password?: boolean;
  appId?: string;
  secret?: string;
  resource?: string;
  baseUrl?: string;
}

async function getKeyFromPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function encryptAesGcm(
  text: string,
  password: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPlaintext = new TextEncoder().encode(text);
  const hexKey = await getKeyFromPassword(password);
  const secretKey = await crypto.subtle.importKey(
    "raw",
    Buffer.from(hexKey, "hex"),
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    secretKey,
    encodedPlaintext,
  );
  return {
    ciphertext: Buffer.from(ciphertext).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
  };
}

type MockJwtClaims = {
  sub?: string;
  email?: string;
  name?: string;
  roles?: string[];
  must_change_password?: boolean;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
};

function createJwt(payload: MockJwtClaims): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = Buffer.from("mock-signature-chronos").toString("base64url");
  return `${header}.${body}.${sig}`;
}

export async function createMockLogtoSessionCookie(
  options: MockUserOptions = {},
): Promise<string> {
  const {
    sub = "10000000-0000-0000-0000-000000000001",
    email = "admin@skanida.sch.id",
    name = "Platform Administrator",
    roles = ["platform_admin"],
    must_change_password = false,
    appId = "chronos-app",
    secret = "complex_password_at_least_32_characters_long_12345",
    resource = "https://api.skanida.sch.id",
  } = options;

  const now = Math.floor(Date.now() / 1000);

  const idToken = createJwt({
    sub,
    email,
    name,
    roles,
    must_change_password,
    aud: appId,
    iss: "http://localhost:3001/oidc",
    exp: now + 86400 * 7,
    iat: now,
  });

  const tokenPayload = {
    sub,
    email,
    name,
    roles,
    must_change_password,
  };
  const tokenString = `mock-user-token.${Buffer.from(JSON.stringify(tokenPayload)).toString("base64url")}`;

  const sessionData = {
    idToken,
    refreshToken: "mock-refresh-token",
    accessToken: JSON.stringify({
      "@": {
        token: tokenString,
        scope: "openid profile email roles custom_data",
        expiresAt: now + 86400 * 7,
      },
      [`@${resource}`]: {
        token: tokenString,
        scope: "mobile:access admin:read files:read:any files:delete:any",
        expiresAt: now + 86400 * 7,
      },
    }),
  };

  const { ciphertext, iv } = await encryptAesGcm(
    JSON.stringify(sessionData),
    secret,
  );
  return `${ciphertext}.${iv}`;
}

export async function authenticateContext(
  context: BrowserContext,
  options: MockUserOptions = {},
): Promise<void> {
  const cookieVal = await createMockLogtoSessionCookie(options);
  const appId = options.appId ?? "chronos-app";

  await context.addCookies([
    {
      name: `logto_${appId}`,
      value: cookieVal,
      url: "http://127.0.0.1:3005",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: `logto_${appId}`,
      value: cookieVal,
      url: "http://localhost:3005",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const now = new Date();
  const ymKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await context.addInitScript((key) => {
    try {
      localStorage.setItem(key, "done");
    } catch {}
  }, `backup_done_${ymKey}`);
}

export type RoleType =
  | "platform_admin"
  | "school_admin"
  | "teacher"
  | "student"
  | "must_change_password";

export async function loginAs(
  page: Page,
  role: RoleType = "platform_admin",
): Promise<void> {
  let options: MockUserOptions;

  switch (role) {
    case "platform_admin":
      options = {
        sub: "10000000-0000-0000-0000-000000000001",
        email: "admin@skanida.sch.id",
        name: "Platform Administrator",
        roles: ["platform_admin"],
        must_change_password: false,
      };
      break;
    case "school_admin":
      options = {
        sub: "10000000-0000-0000-0000-000000000003",
        email: "school_admin@skanida.sch.id",
        name: "School Administrator",
        roles: ["school_admin"],
        must_change_password: false,
      };
      break;
    case "teacher":
      options = {
        sub: "10000000-0000-0000-0000-000000000002",
        email: "teacher@skanida.sch.id",
        name: "Guru Pengajar",
        roles: ["teacher"],
        must_change_password: false,
      };
      break;
    case "student":
      options = {
        sub: "00000000-0000-0000-0000-000000000001",
        email: "ahmad@skanida.sch.id",
        name: "Ahmad Dahlan",
        roles: ["student"],
        must_change_password: false,
      };
      break;
    case "must_change_password":
      options = {
        sub: "10000000-0000-0000-0000-000000000001",
        email: "admin@skanida.sch.id",
        name: "Platform Administrator",
        roles: ["platform_admin"],
        must_change_password: true,
      };
      break;
  }

  await authenticateContext(page.context(), options);
}

export const test = base.extend<{
  adminPage: Page;
  teacherPage: Page;
  studentPage: Page;
}>({
  adminPage: async ({ page, context }, use) => {
    await authenticateContext(context, {
      sub: "10000000-0000-0000-0000-000000000001",
      email: "admin@skanida.sch.id",
      name: "Platform Administrator",
      roles: ["platform_admin"],
    });
    await use(page);
  },
  teacherPage: async ({ page, context }, use) => {
    await authenticateContext(context, {
      sub: "10000000-0000-0000-0000-000000000002",
      email: "teacher@skanida.sch.id",
      name: "Guru Pengajar",
      roles: ["teacher"],
    });
    await use(page);
  },
  studentPage: async ({ page, context }, use) => {
    await authenticateContext(context, {
      sub: "00000000-0000-0000-0000-000000000001",
      email: "ahmad@skanida.sch.id",
      name: "Ahmad Dahlan",
      roles: ["student"],
    });
    await use(page);
  },
});

export { expect };
