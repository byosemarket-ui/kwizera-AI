/**
 * Production HTTP gateway — owns the public listen socket.
 *
 * KWIZERA AI Core evaluates a large module graph and then runs Memory/Knowledge
 * startup on the same thread as the API process. That work is synchronous for
 * long stretches, so a request handler in that process never runs.
 *
 * This process imports only Node HTTP + runtime-env. It answers /api/health
 * immediately and proxies other routes to the app on a loopback port.
 */
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv, resolveBindHost, resolveBindPort } from "../../config/runtime-env.js";

export type GatewayHealthStatus = "starting" | "healthy";

export function sendHealthJson(
  res: ServerResponse,
  status: GatewayHealthStatus,
  extra: Record<string, unknown> = {},
): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    ok: true,
    status,
    name: "KWIZERA AI STUDIO",
    architecture: "kwizera-ai-core",
    gateway: true,
    ...extra,
  }));
}

export function createHealthGateway(options: {
  host: string;
  port: number;
  appHost: string;
  appPort: number;
  getStatus: () => GatewayHealthStatus;
}): Server {
  const { host, port, appHost, appPort, getStatus } = options;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const pathname = (req.url ?? "/").split("?")[0];
    if (pathname === "/api/health") {
      sendHealthJson(res, getStatus(), { host, port });
      return;
    }

    const upstream = httpRequest(
      {
        host: appHost,
        port: appPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `${appHost}:${appPort}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, status: "starting" }));
      } else {
        res.end();
      }
    });
    req.pipe(upstream);
  });

  return server;
}

function resolveProjectRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../..");
}

function resolveInternalPort(publicPort: number): number {
  const raw = process.env.KWIZERA_INTERNAL_PORT;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n < 65536 && n !== publicPort) return n;
  }
  return publicPort === 65535 ? publicPort - 1 : publicPort + 1;
}

export async function main(): Promise<void> {
  const projectRoot = process.env.KWIZERA_PROJECT_ROOT || resolveProjectRoot();
  loadProjectEnv(projectRoot);

  const host = resolveBindHost();
  const port = resolveBindPort();
  const appHost = "127.0.0.1";
  const appPort = resolveInternalPort(port);
  const appEntry = path.join(projectRoot, "dist", "dev", "server", "index.js");

  let status: GatewayHealthStatus = "starting";
  const server = createHealthGateway({
    host,
    port,
    appHost,
    appPort,
    getStatus: () => status,
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      console.log(`[KWIZERA] Gateway listening on ${host}:${port} (health independent of Core)`);
      resolve();
    });
  });

  const childEnv = {
    ...process.env,
    KWIZERA_HOST: appHost,
    KWIZERA_PORT: String(appPort),
    KWIZERA_SKIP_BROWSER_OPEN: "1",
    KWIZERA_PROJECT_ROOT: projectRoot,
  };
  delete childEnv.KWIZERA_BIND_HOST;

  const child: ChildProcess = spawn(process.execPath, [appEntry], {
    cwd: projectRoot,
    env: childEnv,
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });

  console.log(`[KWIZERA] App worker pid=${child.pid} on ${appHost}:${appPort}`);

  const probe = (): void => {
    const req = httpRequest(
      {
        host: appHost,
        port: appPort,
        path: "/api/health",
        method: "GET",
        timeout: 250,
      },
      (up) => {
        const chunks: Buffer[] = [];
        up.on("data", (chunk) => chunks.push(chunk as Buffer));
        up.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { runtimeReady?: boolean; status?: string };
            status = body.runtimeReady === true || body.status === "healthy" ? "healthy" : "starting";
          } catch {
            status = "starting";
          }
        });
      },
    );
    req.on("error", () => {
      /* worker still booting or event-loop blocked — gateway health stays starting */
    });
    req.on("timeout", () => {
      req.destroy();
    });
    req.end();
  };

  const probeTimer = setInterval(probe, 1000);
  probeTimer.unref();
  setTimeout(probe, 200);

  const shutdown = (signal: NodeJS.Signals): void => {
    clearInterval(probeTimer);
    if (child.pid && !child.killed) child.kill(signal);
    server.close();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  child.on("exit", (code, signal) => {
    console.error(`[KWIZERA] App worker exited code=${code} signal=${signal ?? ""}`);
    status = "starting";
    if (!process.env.KWIZERA_GATEWAY_KEEP_ALIVE) process.exit(code || 1);
  });
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error("[KWIZERA] Gateway failed:", error);
    process.exit(1);
  });
}
