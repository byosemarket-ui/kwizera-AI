import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AdminControlPlaneManager } from "../../../../ai/admin-control-plane/admin-control-plane-manager.js";
import { handleAdminApi } from "../../../../dev/server/admin-control-center-api.ts";
import { isAdminEntryPath, resolvePublicUiFile } from "../../../../dev/server/static-ui.ts";

const roots: string[] = [];

async function withServer(manager: AdminControlPlaneManager) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    void handleAdminApi(req, res, url, {
      getManager: () => manager,
      sendJson: (response, status, data) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(data));
      },
      readBody: async (request) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        return Buffer.concat(chunks).toString("utf8");
      },
      dashboardHints: () => ({ aiCoreOnline: true, storageOk: true }),
    }).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end("not admin");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return { server, port: address.port };
}

describe("Admin API routes", () => {
  it("serves dashboard, models, providers, features, settings and never returns raw secrets", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-admin-api-"));
    roots.push(storageRoot);
    const manager = new AdminControlPlaneManager();
    await manager.initialize(storageRoot);
    await manager.upsertProvider({
      name: "Secret Holder",
      type: "custom",
      credentialReference: "super-secret-value-do-not-leak",
      enabled: true,
      status: "active",
    });

    const { server, port } = await withServer(manager);
    try {
      const dashboard = await fetch(`http://127.0.0.1:${port}/api/admin/dashboard`).then((r) => r.json());
      expect(dashboard.system).toBeTruthy();
      expect(dashboard.cost.today).toBe("Not available yet");

      const providers = await fetch(`http://127.0.0.1:${port}/api/admin/providers`).then((r) => r.json());
      const holder = providers.items.find((item: { name: string }) => item.name === "Secret Holder");
      expect(holder.hasCredential).toBe(true);
      expect(JSON.stringify(providers)).not.toContain("super-secret-value-do-not-leak");

      const models = await fetch(`http://127.0.0.1:${port}/api/admin/models`).then((r) => r.json());
      expect(models.total).toBeGreaterThan(0);

      const features = await fetch(`http://127.0.0.1:${port}/api/admin/features`).then((r) => r.json());
      expect(features.items.length).toBeGreaterThan(0);

      const settings = await fetch(`http://127.0.0.1:${port}/api/admin/settings`).then((r) => r.json());
      expect(settings.items.length).toBeGreaterThan(0);

      const health = await fetch(`http://127.0.0.1:${port}/api/admin/health`).then((r) => r.json());
      expect(health.ok).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it("routes /admin to the studio SPA entry", () => {
    expect(isAdminEntryPath("/admin")).toBe(true);
    expect(isAdminEntryPath("/admin/models")).toBe(true);
    const uiDir = path.join(os.tmpdir(), `kwizera-admin-ui-${Date.now()}`);
    // resolvePublicUiFile needs real files — covered by static-ui tests with fixtures
    expect(typeof resolvePublicUiFile).toBe("function");
    void uiDir;
  });
});
