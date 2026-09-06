import fs from "node:fs";
import { spawn, execSync } from "node:child_process";
import type http from "node:http";
import { MockAstraLogtoServer } from "./mock-server.ts";

const ASTRA_PORT = parseInt(process.env.MOCK_ASTRA_PORT || "23500", 10);
const LOGTO_PORT = parseInt(process.env.MOCK_LOGTO_PORT || "23501", 10);
const CHRONOS_PORT = parseInt(process.env.PORT || "3055", 10);

function cleanPort(port: number) {
  try {
    execSync(`fuser -k -9 ${port}/tcp`, {
      stdio: ["ignore", "ignore", "ignore"],
    });
    console.log(
      `[start-servers] Cleaned up socket on port ${port} using fuser`,
    );
  } catch {
    // Port was free or fuser not available
  }
  try {
    const output = execSync(`lsof -t -i :${port}`, {
      stdio: ["pipe", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (output) {
      for (const pidStr of output.split(/\s+/)) {
        const pid = parseInt(pidStr, 10);
        if (pid && pid !== process.pid) {
          try {
            process.kill(pid, "SIGKILL");
            console.log(
              `[start-servers] Cleaned up stale process ${pid} on port ${port}`,
            );
          } catch {}
        }
      }
    }
  } catch {
    // Port is already free
  }
}

async function main() {
  // Clean up any stale processes from previous test runs
  cleanPort(ASTRA_PORT);
  cleanPort(LOGTO_PORT);
  cleanPort(CHRONOS_PORT);

  const mockServer = new MockAstraLogtoServer(ASTRA_PORT, LOGTO_PORT);
  await mockServer.start();
  console.log(
    `[MockServer] Astra running on :${ASTRA_PORT}, Logto running on :${LOGTO_PORT}`,
  );

  // Install mock server control handler for outage simulation on Astra server
  const astraServer = (mockServer as unknown as { astraServer: http.Server })
    .astraServer;
  if (astraServer) {
    const existingListeners = astraServer.listeners("request").slice();
    astraServer.removeAllListeners("request");

    let astraSimulateOutage: "none" | "503" | "timeout" = "none";

    astraServer.on("request", (req, res) => {
      const url = req.url || "";
      if (url === "/mock/simulate-astra-outage" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            astraSimulateOutage = data.mode ?? "none";
          } catch {
            astraSimulateOutage = "503";
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ astraSimulateOutage }));
        });
        return;
      }

      if (url === "/ready") {
        if (astraSimulateOutage === "503") {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", healthy: false }));
          return;
        }
        if (astraSimulateOutage === "timeout") {
          setTimeout(() => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok", healthy: true }));
          }, 4000);
          return;
        }
      }

      for (const listener of existingListeners) {
        (
          listener as (
            req: http.IncomingMessage,
            res: http.ServerResponse,
          ) => void
        ).call(astraServer, req, res);
      }
    });
  }

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(CHRONOS_PORT),
    ASTRA_API_URL: `http://127.0.0.1:${ASTRA_PORT}`,
    LOGTO_ENDPOINT: `http://127.0.0.1:${LOGTO_PORT}`,
    LOGTO_APP_ID: "chronos-app",
    LOGTO_APP_SECRET: "chronos-secret-key-at-least-32-chars",
    LOGTO_COOKIE_SECRET: "complex_password_at_least_32_characters_long_12345",
    LOGTO_BASE_URL: `http://localhost:${CHRONOS_PORT}`,
    LOGTO_POST_LOGOUT_REDIRECT_URI: `http://localhost:${CHRONOS_PORT}/login`,
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

  let cleaningUp = false;
  const cleanup = async (exitCode = 0) => {
    if (cleaningUp) return;
    cleaningUp = true;
    console.log("[MockServer] Shutting down and cleaning up ports...");

    if (nextProcess.pid) {
      try {
        nextProcess.kill("SIGTERM");
      } catch {}
      try {
        process.kill(nextProcess.pid, "SIGTERM");
      } catch {}
    }

    try {
      await mockServer.stop();
    } catch {}

    cleanPort(ASTRA_PORT);
    cleanPort(LOGTO_PORT);
    cleanPort(CHRONOS_PORT);

    if (nextProcess.pid) {
      try {
        nextProcess.kill("SIGKILL");
      } catch {}
      try {
        process.kill(nextProcess.pid, "SIGKILL");
      } catch {}
    }

    process.exit(exitCode);
  };

  process.on("SIGINT", () => void cleanup(0));
  process.on("SIGTERM", () => void cleanup(0));
  process.on("SIGHUP", () => void cleanup(0));
  process.on("exit", () => {
    if (nextProcess.pid) {
      try {
        nextProcess.kill("SIGKILL");
      } catch {}
      try {
        process.kill(nextProcess.pid, "SIGKILL");
      } catch {}
    }
    cleanPort(ASTRA_PORT);
    cleanPort(LOGTO_PORT);
    cleanPort(CHRONOS_PORT);
  });

  nextProcess.on("exit", async (code: number | null) => {
    await cleanup(code ?? 0);
  });
}

main().catch((err) => {
  console.error("Failed to start test servers:", err);
  process.exit(1);
});
