import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT || "3055";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const MOCK_ASTRA_PORT = process.env.MOCK_ASTRA_PORT || "23500";
const MOCK_LOGTO_PORT = process.env.MOCK_LOGTO_PORT || "23501";

process.env.MOCK_ASTRA_PORT = MOCK_ASTRA_PORT;
process.env.MOCK_LOGTO_PORT = MOCK_LOGTO_PORT;

// Set fixture-owned non-secret test env defaults if not already present
process.env.LOGTO_POST_LOGOUT_REDIRECT_URI =
  process.env.LOGTO_POST_LOGOUT_REDIRECT_URI || `${BASE_URL}/login`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  reporter: process.env.CI
    ? [
        ["list"],
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["json", { outputFile: "playwright-report/test-results.json" }],
      ]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["json", { outputFile: "playwright-report/test-results.json" }],
      ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    ...(process.env.RUN_A11Y_TESTS
      ? [
          {
            name: "tablet",
            testMatch: /a11y-responsive\.spec\.ts/,
            testIgnore: [],
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1024, height: 768 },
            },
          },
          {
            name: "mobile",
            testMatch: /a11y-responsive\.spec\.ts/,
            testIgnore: [],
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 390, height: 844 },
            },
          },
        ]
      : []),
  ],
  webServer: {
    command: "node --no-warnings e2e/fixtures/start-servers.ts",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: Boolean(process.env.PLAYWRIGHT_REUSE_SERVER),
    timeout: 60000,
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 5000,
    },
    env: {
      PORT,
      MOCK_ASTRA_PORT,
      MOCK_LOGTO_PORT,
      LOGTO_POST_LOGOUT_REDIRECT_URI:
        process.env.LOGTO_POST_LOGOUT_REDIRECT_URI || `${BASE_URL}/login`,
    },
  },
});
