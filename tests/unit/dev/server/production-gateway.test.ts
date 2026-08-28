import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createHealthGateway } from "../../../../dev/server/production-gateway.js";

const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe("production HTTP gateway", () => {
  it("answers /api/health immediately while the app process accepts TCP but never responds", async () => {
    const hanging = createServer(() => {
      /* accept the socket and never write a response */
    });
    servers.push(hanging);
    await new Promise<void>((resolve) => hanging.listen(0, "127.0.0.1", resolve));
    const hangingAddress = hanging.address();
    if (!hangingAddress || typeof hangingAddress === "string") throw new Error("hanging server has no port");

    const gateway = createHealthGateway({
      host: "127.0.0.1",
      port: 0,
      appHost: "127.0.0.1",
      appPort: hangingAddress.port,
      getStatus: () => "starting",
    });
    servers.push(gateway);
    await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
    const gatewayAddress = gateway.address();
    if (!gatewayAddress || typeof gatewayAddress === "string") throw new Error("gateway has no port");

    const started = Date.now();
    const response = await fetch(`http://127.0.0.1:${gatewayAddress.port}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    const elapsed = Date.now() - started;
    const body = await response.json() as { ok?: boolean; status?: string; gateway?: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("starting");
    expect(body.gateway).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("includes runtimeReady from getExtra without treating a failed Core boot as healthy", async () => {
    const hanging = createServer(() => {
      /* unused upstream */
    });
    servers.push(hanging);
    await new Promise<void>((resolve) => hanging.listen(0, "127.0.0.1", resolve));
    const hangingAddress = hanging.address();
    if (!hangingAddress || typeof hangingAddress === "string") throw new Error("hanging server has no port");

    const gateway = createHealthGateway({
      host: "127.0.0.1",
      port: 0,
      appHost: "127.0.0.1",
      appPort: hangingAddress.port,
      getStatus: () => "starting",
      getExtra: () => ({
        runtimeReady: false,
        sessionRestored: false,
        message: "Runtime boot failed: Unknown memory category: learning-intelligence-runtime",
      }),
    });
    servers.push(gateway);
    await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
    const gatewayAddress = gateway.address();
    if (!gatewayAddress || typeof gatewayAddress === "string") throw new Error("gateway has no port");

    const response = await fetch(`http://127.0.0.1:${gatewayAddress.port}/api/health`);
    const body = await response.json() as {
      status?: string;
      runtimeReady?: boolean;
      sessionRestored?: boolean;
      message?: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("starting");
    expect(body.runtimeReady).toBe(false);
    expect(body.sessionRestored).toBe(false);
    expect(body.message).toContain("Unknown memory category");
  });
});
