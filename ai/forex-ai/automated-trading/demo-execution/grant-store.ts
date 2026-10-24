/**
 * Phase 58.3 — time-bounded DEMO execution grants (server-enforced).
 * Does not flip global placesOrders / acceptsForExecution.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DemoExecutionGrant } from "./types.js";

const DEFAULT_TTL_MS = 15 * 60_000;
const MAX_TTL_MS = 60 * 60_000;

function defaultPath(): string {
  return join(process.cwd(), "data", "forex", "demo-execution-grants.json");
}

export class DemoExecutionGrantStore {
  private readonly path: string;
  private grants: DemoExecutionGrant[] = [];

  constructor(path = defaultPath()) {
    this.path = path;
    this.load();
  }

  private load(): void {
    try {
      if (!existsSync(this.path)) {
        this.grants = [];
        return;
      }
      const raw = JSON.parse(readFileSync(this.path, "utf8")) as { grants?: DemoExecutionGrant[] };
      this.grants = Array.isArray(raw.grants) ? raw.grants : [];
    } catch {
      this.grants = [];
    }
  }

  private save(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(
      this.path,
      JSON.stringify({ schemaVersion: "demo-execution-grants-v1", grants: this.grants }, null, 2),
      "utf8",
    );
  }

  listActive(nowMs = Date.now()): DemoExecutionGrant[] {
    return this.grants.filter((g) => this.isActive(g, nowMs));
  }

  isActive(grant: DemoExecutionGrant, nowMs = Date.now()): boolean {
    if (grant.revokedAtUtc) return false;
    if (grant.environment !== "DEMO") return false;
    return Date.parse(grant.expiresAtUtc) > nowMs;
  }

  get(grantId: string): DemoExecutionGrant | null {
    return this.grants.find((g) => g.grantId === grantId) ?? null;
  }

  create(input: {
    ttlMs?: number;
    accountIdMasked?: string | null;
    instrumentAllowlist?: string[];
    maxLots?: number;
  }): DemoExecutionGrant {
    const ttl = Math.max(60_000, Math.min(MAX_TTL_MS, Math.floor(input.ttlMs ?? DEFAULT_TTL_MS)));
    const now = Date.now();
    const grant: DemoExecutionGrant = {
      grantId: randomUUID(),
      createdAtUtc: new Date(now).toISOString(),
      expiresAtUtc: new Date(now + ttl).toISOString(),
      revokedAtUtc: null,
      accountIdMasked: input.accountIdMasked ?? null,
      instrumentAllowlist: (input.instrumentAllowlist ?? []).map((s) => s.trim()).filter(Boolean),
      maxLots: Math.max(1, Math.min(10, Math.floor(input.maxLots ?? 1))),
      createdBy: "admin",
      purpose: "PHASE_58_3_DEMO_LIFECYCLE",
      environment: "DEMO",
    };
    this.grants.unshift(grant);
    this.grants = this.grants.slice(0, 50);
    this.save();
    return grant;
  }

  revoke(grantId: string): DemoExecutionGrant | null {
    const g = this.get(grantId);
    if (!g) return null;
    if (!g.revokedAtUtc) {
      g.revokedAtUtc = new Date().toISOString();
      this.save();
    }
    return g;
  }

  requireActive(grantId: string, instrument?: string, lots?: number): {
    ok: true;
    grant: DemoExecutionGrant;
  } | {
    ok: false;
    code: string;
    error: string;
  } {
    const grant = this.get(grantId);
    if (!grant) return { ok: false, code: "GRANT_NOT_FOUND", error: "DEMO grant not found." };
    if (!this.isActive(grant)) {
      return { ok: false, code: "GRANT_EXPIRED_OR_REVOKED", error: "DEMO grant expired or revoked." };
    }
    if (instrument && grant.instrumentAllowlist.length) {
      const ok = grant.instrumentAllowlist.some(
        (a) => a.replace(/\s+/g, "").toUpperCase() === instrument.replace(/\s+/g, "").toUpperCase(),
      );
      if (!ok) {
        return { ok: false, code: "INSTRUMENT_NOT_ALLOWLISTED", error: "Instrument not on DEMO grant allowlist." };
      }
    }
    if (lots != null && lots > grant.maxLots) {
      return { ok: false, code: "LOTS_EXCEED_GRANT", error: `lots exceeds grant maxLots=${grant.maxLots}.` };
    }
    return { ok: true, grant };
  }
}

let singleton: DemoExecutionGrantStore | null = null;

export function getDemoExecutionGrantStore(): DemoExecutionGrantStore {
  if (!singleton) singleton = new DemoExecutionGrantStore();
  return singleton;
}

export function resetDemoExecutionGrantStoreForTests(): void {
  singleton = null;
}
