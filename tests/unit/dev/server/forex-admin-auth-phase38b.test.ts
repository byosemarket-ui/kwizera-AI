import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertAdminAccess,
  resolveAdminAuthMode,
} from "../../../../ai/admin-control-plane/admin-auth-boundary.js";
import { requireForexAdmin } from "../../../../dev/server/forex-admin-auth.js";

describe("Phase 38B Forex Admin auth", () => {
  const prevMode = process.env.KWIZERA_ADMIN_AUTH_MODE;
  const prevToken = process.env.KWIZERA_ADMIN_API_TOKEN;

  afterEach(() => {
    if (prevMode === undefined) delete process.env.KWIZERA_ADMIN_AUTH_MODE;
    else process.env.KWIZERA_ADMIN_AUTH_MODE = prevMode;
    if (prevToken === undefined) delete process.env.KWIZERA_ADMIN_API_TOKEN;
    else process.env.KWIZERA_ADMIN_API_TOKEN = prevToken;
  });

  it("rejects without token when require-admin-token; allows with correct token", () => {
    process.env.KWIZERA_ADMIN_AUTH_MODE = "require-admin-token";
    process.env.KWIZERA_ADMIN_API_TOKEN = "phase38b-forex-admin-token";
    expect(resolveAdminAuthMode()).toBe("require-admin-token");

    const denied = assertAdminAccess({
      roles: [],
      path: "/api/forex-admin/overview",
      adminApi: true,
    });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/token/i);
    expect(JSON.stringify(denied)).not.toContain("phase38b-forex-admin-token");

    const allowed = assertAdminAccess({
      roles: [],
      path: "/api/forex-admin/overview",
      adminApi: true,
      adminToken: "phase38b-forex-admin-token",
    });
    expect(allowed.allowed).toBe(true);

    let status = 0;
    let body: unknown = null;
    const sendJson = (_res: http.ServerResponse, code: number, data: unknown) => {
      status = code;
      body = data;
    };
    const req = {
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    expect(requireForexAdmin(req, res, sendJson, "/api/forex-admin/meta")).toBe(false);
    expect(status).toBe(403);
    expect((body as { error?: { code?: string } })?.error?.code).toBe("ADMIN_FORBIDDEN");

    const reqOk = {
      headers: {
        "x-kwizera-admin-token": "phase38b-forex-admin-token",
        authorization: "Bearer phase38b-forex-admin-token",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as http.IncomingMessage;
    status = 0;
    expect(requireForexAdmin(reqOk, res, sendJson, "/api/forex-admin/meta")).toBe(true);
    expect(status).toBe(0);
  });

  it("wires requireForexAdmin into forex-admin and intelligence APIs; evaluate gated in memory API", () => {
    const root = path.resolve(process.cwd());
    const adminApi = fs.readFileSync(path.join(root, "dev/server/forex-admin-api.ts"), "utf8");
    const intelApi = fs.readFileSync(path.join(root, "dev/server/forex-intelligence-api.ts"), "utf8");
    const memoryApi = fs.readFileSync(path.join(root, "dev/server/forex-memory-api.ts"), "utf8");

    expect(adminApi).toContain("requireForexAdmin");
    expect(adminApi).toContain('authentication: "admin-token"');
    expect(adminApi).toContain("upload-pdf");
    expect(adminApi).toContain("deleteDocument");
    expect(intelApi).toContain("requireForexAdmin");
    expect(memoryApi).toContain('sub === "/evaluate"');
    expect(memoryApi).toMatch(/\/evaluate[\s\S]*requireForexAdmin/);
  });

  it("exports handleForexAdminApi for smoke import", async () => {
    const mod = await import("../../../../dev/server/forex-admin-api.js");
    expect(typeof mod.handleForexAdminApi).toBe("function");
  });
});
