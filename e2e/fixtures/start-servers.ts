import fs from "node:fs";
import { spawn } from "node:child_process";
import { MockAstraLogtoServer } from "./mock-server.ts";

const ASTRA_PORT = parseInt(process.env.MOCK_ASTRA_PORT || "23000", 10);
const LOGTO_PORT = parseInt(process.env.MOCK_LOGTO_PORT || "23001", 10);
const CHRONOS_PORT = parseInt(process.env.PORT || "3005", 10);

async function main() {
  const mockServer = new MockAstraLogtoServer(ASTRA_PORT, LOGTO_PORT);
  await mockServer.start();
  console.log(
    `[MockServer] Astra running on :${ASTRA_PORT}, Logto running on :${LOGTO_PORT}`,
  );

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(CHRONOS_PORT),
    ASTRA_API_URL: `http://127.0.0.1:${ASTRA_PORT}`,
    LOGTO_ENDPOINT: `http://127.0.0.1:${LOGTO_PORT}`,
    LOGTO_APP_ID: "chronos-app",
    LOGTO_APP_SECRET: "chronos-secret-key-at-least-32-chars",
    LOGTO_COOKIE_SECRET: "complex_password_at_least_32_characters_long_12345",
    LOGTO_BASE_URL: `http://localhost:${CHRONOS_PORT}`,
    LOGTO_RESOURCE: "https://api.skanida.sch.id",
    NODE_ENV: "test",
  };

  const hasBuild = fs.existsSync(".next");
  const useProd =
    process.env.CHRONOS_START_MODE === "prod" ||
    (hasBuild && process.env.CHRONOS_START_MODE !== "dev");
  const useStandalone = useProd && fs.existsSync(".next/standalone/server.js");

  if (useStandalone) {
    // Next's standalone server changes cwd to .next/standalone. Mirror the
    // static runtime assets there, matching the production Dockerfile layout.
    fs.mkdirSync(".next/standalone/.next", { recursive: true });
    fs.cpSync(".next/static", ".next/standalone/.next/static", {
      recursive: true,
      force: true,
    });
    fs.cpSync("public", ".next/standalone/public", {
      recursive: true,
      force: true,
    });
  }

  const cmd = useStandalone ? "node" : "npx";
  const args = useStandalone
    ? [".next/standalone/server.js"]
    : useProd
      ? ["next", "start", "-p", String(CHRONOS_PORT)]
      : ["next", "dev", "-p", String(CHRONOS_PORT)];

  console.log(
    `[Chronos] Launching ${cmd} ${args.join(" ")} on port ${CHRONOS_PORT}...`,
  );
  const nextProcess = spawn(cmd, args, {
    env: childEnv,
    stdio: "inherit",
  });

  const cleanup = async () => {
    console.log("[MockServer] Shutting down...");
    nextProcess.kill();
    await mockServer.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  nextProcess.on("exit", async (code: number | null) => {
    await mockServer.stop();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("Failed to start test servers:", err);
  process.exit(1);
});
