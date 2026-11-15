/**
 * HFM MT5 Connection Manager — Demo + Live credential metadata + vault.
 *
 * Passwords (AES-256-GCM via AiSecretsManager):
 * - Demo: `mt5-hfm:demo:password`
 * - Live: `mt5-hfm:live:password`
 *
 * Metadata (never passwords):
 * - `{storageRoot}/mt5-hfm/demo-profile.json`
 * - `{storageRoot}/mt5-hfm/live-profile.json`
 *
 * Live credential storage is allowed. Live login / authenticated use is
 * fail-closed via `live-gate.ts` until separate owner authorization.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { AiSecretsManager } from "../../connector-management/secrets-manager.js";
import { maskCredential } from "../../admin-control-plane/admin-auth-boundary.js";
import {
  MT5_HFM_LIVE_PASSWORD_SECRET_ID,
  publicLiveGate,
  type Mt5HfmLiveGatePublic,
} from "./live-gate.js";

export const MT5_HFM_DEMO_PASSWORD_SECRET_ID = "mt5-hfm:demo:password";
export { MT5_HFM_LIVE_PASSWORD_SECRET_ID };

export type Mt5HfmEnvironment = "demo" | "live";

export const HFM_DEMO_SERVER_ALLOWLIST = [
  "HFMarketsGlobal-Demo",
  "HFMarketsGlobal-Demo3",
  "HFMarketsGlobal-Demo4",
  "HFMarkets-Demo",
  "HFMarketsSC-Demo",
  "HFMarketsSC-Demo2",
  "HFMarketsSC-Demo3",
  "HFMarketsKE-Demo2",
  "HFMarketsKM-Demo",
  "HFMarketsMENA-Demo2",
  "HFMarketsSA-Demo",
  "HFMarketsSA-Demo2",
  "HFMarketsUK-Demo2",
] as const;

export const HFM_LIVE_SERVER_ALLOWLIST = [
  "HFMarketsGlobal-Live1",
  "HFMarketsGlobal-Live2",
  "HFMarketsGlobal-Live3",
  "HFMarketsSC-Live1",
  "HFMarketsSC-Live2",
  "HFMarketsSC-Live3",
  "HFMarkets-Live1",
  "HFMarkets-Live2",
] as const;

export interface Mt5HfmAccountInfoPublic {
  loginHint: string | null;
  server: string | null;
  currency: string | null;
  balance: number | null;
  equity: number | null;
  freeMargin: number | null;
  marginLevel: number | null;
  leverage: string | null;
  company: string | null;
  syncedAt: string | null;
  note: string | null;
}

/** @deprecated Use Mt5HfmAccountInfoPublic */
export type Mt5HfmDemoAccountInfoPublic = Mt5HfmAccountInfoPublic;

export interface Mt5HfmEnvPublicStatus {
  environment: Mt5HfmEnvironment;
  loginConfigured: boolean;
  passwordConfigured: boolean;
  serverConfigured: boolean;
  configured: boolean;
  loginHint: string | null;
  server: string | null;
  credentialsUpdatedAt: string | null;
  connectionStatus: string | null;
  lastAuthStatus: string | null;
  lastAuthAt: string | null;
  lastAuthError: string | null;
  lastSyncAt: string | null;
  lastProbeAt: string | null;
  lastProbeSummary: string | null;
  account: Mt5HfmAccountInfoPublic | null;
  allowedServers: readonly string[];
  /** Live-only flags */
  activationLocked?: boolean;
  loginEnabled?: boolean;
  connectionTestEnabled?: boolean;
  note: string;
}

export interface Mt5HfmPublicStatus {
  ok: true;
  vaultUnlocked: boolean;
  storageMode: "encrypted-vault" | "unavailable";
  persistenceWarning: string | null;
  liveGate: Mt5HfmLiveGatePublic;
  /** Convenience: Live login/trading unavailable */
  liveAvailable: false;
  liveNote: string;
  demo: Mt5HfmEnvPublicStatus;
  live: Mt5HfmEnvPublicStatus;
  mt5LoginBridge: "not_implemented";
  note: string;
  /**
   * Backward-compatible Demo flat fields (same as `demo.*`).
   * Prefer `demo` / `live` for new clients.
   */
  environment: "demo";
  loginConfigured: boolean;
  passwordConfigured: boolean;
  serverConfigured: boolean;
  configured: boolean;
  loginHint: string | null;
  server: string | null;
  credentialsUpdatedAt: string | null;
  connectionStatus: string | null;
  lastAuthStatus: string | null;
  lastAuthAt: string | null;
  lastAuthError: string | null;
  lastSyncAt: string | null;
  lastProbeAt: string | null;
  lastProbeSummary: string | null;
  account: Mt5HfmAccountInfoPublic | null;
  allowedServers: readonly string[];
}

/** @deprecated Prefer Mt5HfmPublicStatus */
export type Mt5HfmDemoPublicStatus = Mt5HfmPublicStatus;

interface EnvMetaFile {
  login: string;
  server: string;
  credentialsUpdatedAt: string | null;
  connectionStatus: string | null;
  lastAuthStatus: string | null;
  lastAuthAt: string | null;
  lastAuthError: string | null;
  lastSyncAt: string | null;
  lastProbeAt: string | null;
  lastProbeSummary: string | null;
  account: Mt5HfmAccountInfoPublic | null;
}

function emptyMeta(): EnvMetaFile {
  return {
    login: "",
    server: "",
    credentialsUpdatedAt: null,
    connectionStatus: null,
    lastAuthStatus: null,
    lastAuthAt: null,
    lastAuthError: null,
    lastSyncAt: null,
    lastProbeAt: null,
    lastProbeSummary: null,
    account: null,
  };
}

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

function secretIdFor(env: Mt5HfmEnvironment): string {
  return env === "live" ? MT5_HFM_LIVE_PASSWORD_SECRET_ID : MT5_HFM_DEMO_PASSWORD_SECRET_ID;
}

function metaFileName(env: Mt5HfmEnvironment): string {
  return env === "live" ? "live-profile.json" : "demo-profile.json";
}

export function parseMt5HfmEnvironment(raw: unknown, fallback: Mt5HfmEnvironment = "demo"): Mt5HfmEnvironment {
  const v = String(raw ?? fallback).trim().toLowerCase();
  if (v === "live" || v === "real" || v === "production") return "live";
  if (v === "demo") return "demo";
  throw new Error("environment must be demo or live");
}

export function isLiveLookingServer(server: string): boolean {
  return /live|real|prod/i.test(server);
}

export function isDemoLookingServer(server: string): boolean {
  return /demo/i.test(server);
}

export function validateAccountLogin(raw: unknown, env: Mt5HfmEnvironment): string {
  const login = String(raw ?? "").trim();
  const label = env === "live" ? "Live" : "Demo";
  if (!login) throw new Error(`${label} account number is required.`);
  if (login.length < 4 || login.length > 32) {
    throw new Error(`${label} account number must be 4–32 characters.`);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(login)) {
    throw new Error(`${label} account number contains invalid characters.`);
  }
  return login;
}

export function validateDemoLogin(raw: unknown): string {
  return validateAccountLogin(raw, "demo");
}

export function validateLiveLogin(raw: unknown): string {
  return validateAccountLogin(raw, "live");
}

export function validateDemoServer(raw: unknown): string {
  const server = String(raw ?? "").trim();
  if (!server) throw new Error("Demo server name is required.");
  if (server.length < 3 || server.length > 64) {
    throw new Error("Demo server name must be 3–64 characters.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(server)) {
    throw new Error("Demo server name contains invalid characters.");
  }
  if (isLiveLookingServer(server)) {
    throw new Error("Live server names are not allowed for Demo credentials.");
  }
  return server;
}

export function validateLiveServer(raw: unknown): string {
  const server = String(raw ?? "").trim();
  if (!server) throw new Error("Live server name is required.");
  if (server.length < 3 || server.length > 64) {
    throw new Error("Live server name must be 3–64 characters.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(server)) {
    throw new Error("Live server name contains invalid characters.");
  }
  if (isDemoLookingServer(server)) {
    throw new Error("Demo server names are not allowed for Live credentials.");
  }
  return server;
}

export function validatePassword(raw: unknown): string {
  const password = String(raw ?? "");
  if (password.length < 4) throw new Error("Password must be at least 4 characters.");
  if (password.length > 128) throw new Error("Password must be at most 128 characters.");
  if (/[\r\n\0]/.test(password)) throw new Error("Password contains invalid control characters.");
  return password;
}

/** @deprecated Use validatePassword */
export function validateDemoPassword(raw: unknown): string {
  return validatePassword(raw);
}

async function readMetaFile(dir: string, env: Mt5HfmEnvironment): Promise<EnvMetaFile> {
  try {
    const raw = await fs.readFile(path.join(dir, metaFileName(env)), "utf8");
    const parsed = JSON.parse(raw) as Partial<EnvMetaFile>;
    const file: EnvMetaFile = {
      ...emptyMeta(),
      ...parsed,
      login: String(parsed.login ?? ""),
      server: String(parsed.server ?? ""),
    };
    delete (file as { password?: unknown }).password;
    return file;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return emptyMeta();
  }
}

export class Mt5HfmDemoProfileManager {
  private storageRoot = "";
  private secrets: AiSecretsManager | null = null;
  private demo: EnvMetaFile = emptyMeta();
  private live: EnvMetaFile = emptyMeta();
  private initialized = false;

  async initialize(storageRoot = resolveStorageRoot()): Promise<void> {
    this.storageRoot = storageRoot;
    const root = path.join(storageRoot, "mt5-hfm");
    await fs.mkdir(root, { recursive: true });
    try {
      const secrets = new AiSecretsManager();
      await secrets.initialize(storageRoot);
      this.secrets = secrets;
    } catch {
      this.secrets = null;
    }
    this.demo = await readMetaFile(root, "demo");
    this.live = await readMetaFile(root, "live");
    this.initialized = true;
  }

  ensureInitialized(): void {
    if (!this.initialized) throw new Error("MT5 HFM profile manager is not initialized");
  }

  vaultUnlocked(): boolean {
    return Boolean(this.secrets?.isUnlocked());
  }

  storageMode(): "encrypted-vault" | "unavailable" {
    return this.vaultUnlocked() ? "encrypted-vault" : "unavailable";
  }

  private meta(env: Mt5HfmEnvironment): EnvMetaFile {
    return env === "live" ? this.live : this.demo;
  }

  private setMeta(env: Mt5HfmEnvironment, next: EnvMetaFile): void {
    if (env === "live") this.live = next;
    else this.demo = next;
  }

  async saveCredentials(input: {
    environment?: Mt5HfmEnvironment | string;
    login: string;
    server: string;
    password: string;
  }): Promise<Mt5HfmPublicStatus> {
    this.ensureInitialized();
    const env = parseMt5HfmEnvironment(input.environment ?? "demo");
    const login = validateAccountLogin(input.login, env);
    const server = env === "live" ? validateLiveServer(input.server) : validateDemoServer(input.server);
    const password = validatePassword(input.password);
    const sid = secretIdFor(env);

    if (!this.vaultUnlocked() || !this.secrets) {
      throw new Error(
        "Encrypted vault is locked or unavailable. Set KWIZERA_SECRETS_PASSPHRASE on the server and restart. Credentials were not saved.",
      );
    }

    const next: EnvMetaFile = {
      ...this.meta(env),
      login,
      server,
      credentialsUpdatedAt: new Date().toISOString(),
      connectionStatus: "credentials_saved",
      lastAuthError: null,
      account: null,
      lastSyncAt: null,
    };
    this.setMeta(env, next);

    await this.secrets.set(sid, password);
    if (!this.secrets.has(sid)) {
      throw new Error("Credential vault write verification failed. Credentials were not saved.");
    }
    const stored = this.secrets.get(sid);
    if (stored !== password) {
      throw new Error("Credential vault round-trip verification failed. Credentials were not saved.");
    }
    // Isolation: never copy between namespaces.
    await this.persistMeta(env);
    return this.publicStatus();
  }

  async clearCredentials(environment: Mt5HfmEnvironment | string = "demo"): Promise<Mt5HfmPublicStatus> {
    this.ensureInitialized();
    const env = parseMt5HfmEnvironment(environment);
    const sid = secretIdFor(env);
    if (this.secrets?.has(sid)) {
      await this.secrets.remove(sid);
    }
    const cleared = emptyMeta();
    cleared.connectionStatus = "cleared";
    this.setMeta(env, cleared);
    await this.persistMeta(env);
    return this.publicStatus();
  }

  /** Runtime-only decrypt. Never call from GET handlers that return JSON to browsers. */
  getPassword(environment: Mt5HfmEnvironment): string | null {
    this.ensureInitialized();
    const sid = secretIdFor(environment);
    if (!this.vaultUnlocked() || !this.secrets?.has(sid)) return null;
    try {
      const value = this.secrets.get(sid);
      return value.length >= 4 ? value : null;
    } catch {
      return null;
    }
  }

  getDemoPassword(): string | null {
    return this.getPassword("demo");
  }

  /** Present for symmetry — callers must still pass Live gate before any use. */
  getLivePassword(): string | null {
    return this.getPassword("live");
  }

  getLoginMeta(environment: Mt5HfmEnvironment): { login: string; server: string } | null {
    this.ensureInitialized();
    const file = this.meta(environment);
    const login = file.login.trim();
    const server = file.server.trim();
    if (!login || !server) return null;
    return { login, server };
  }

  getDemoLoginMeta(): { login: string; server: string } | null {
    return this.getLoginMeta("demo");
  }

  async recordProbeResult(
    environment: Mt5HfmEnvironment,
    result: {
      status: string;
      errorMessage?: string | null;
      summary?: string | null;
    },
  ): Promise<void> {
    this.ensureInitialized();
    if (environment !== "demo") {
      throw new Error("Probe results may only be recorded for Demo while Live activation is locked.");
    }
    const file = this.meta("demo");
    file.lastProbeAt = new Date().toISOString();
    file.lastProbeSummary = result.summary ? String(result.summary).slice(0, 400) : null;
    file.lastAuthStatus = result.status;
    file.lastAuthAt = file.lastProbeAt;
    file.lastAuthError = result.errorMessage ? String(result.errorMessage).slice(0, 400) : null;
    file.connectionStatus = result.status;
    await this.persistMeta("demo");
  }

  private envPublicStatus(env: Mt5HfmEnvironment): Mt5HfmEnvPublicStatus {
    const file = this.meta(env);
    const loginOk = Boolean(file.login.trim());
    const serverOk = Boolean(file.server.trim());
    const pwdOk = Boolean(this.vaultUnlocked() && this.secrets?.has(secretIdFor(env)));
    const gate = publicLiveGate();
    if (env === "demo") {
      return {
        environment: "demo",
        loginConfigured: loginOk,
        passwordConfigured: pwdOk,
        serverConfigured: serverOk,
        configured: loginOk && serverOk && pwdOk,
        loginHint: file.login ? maskCredential(file.login) : null,
        server: file.server || null,
        credentialsUpdatedAt: file.credentialsUpdatedAt,
        connectionStatus: file.connectionStatus,
        lastAuthStatus: file.lastAuthStatus,
        lastAuthAt: file.lastAuthAt,
        lastAuthError: file.lastAuthError,
        lastSyncAt: file.lastSyncAt,
        lastProbeAt: file.lastProbeAt,
        lastProbeSummary: file.lastProbeSummary,
        account: file.account,
        allowedServers: HFM_DEMO_SERVER_ALLOWLIST,
        note: "Demo credentials. Passwords are never returned. Terminal login bridge not enabled yet.",
      };
    }
    return {
      environment: "live",
      loginConfigured: loginOk,
      passwordConfigured: pwdOk,
      serverConfigured: serverOk,
      configured: loginOk && serverOk && pwdOk,
      loginHint: file.login ? maskCredential(file.login) : null,
      server: file.server || null,
      credentialsUpdatedAt: file.credentialsUpdatedAt,
      connectionStatus: file.connectionStatus,
      lastAuthStatus: file.lastAuthStatus,
      lastAuthAt: file.lastAuthAt,
      lastAuthError: file.lastAuthError,
      lastSyncAt: null,
      lastProbeAt: null,
      lastProbeSummary: null,
      account: null,
      allowedServers: HFM_LIVE_SERVER_ALLOWLIST,
      activationLocked: true,
      loginEnabled: gate.loginEnabled,
      connectionTestEnabled: gate.connectionTestEnabled,
      note: gate.note,
    };
  }

  publicStatus(): Mt5HfmPublicStatus {
    this.ensureInitialized();
    const mode = this.storageMode();
    const gate = publicLiveGate();
    const demo = this.envPublicStatus("demo");
    const live = this.envPublicStatus("live");
    return {
      ok: true,
      vaultUnlocked: this.vaultUnlocked(),
      storageMode: mode,
      persistenceWarning: mode === "unavailable"
        ? "Secrets vault locked or unavailable. Set KWIZERA_SECRETS_PASSPHRASE to enable encrypted credential persistence."
        : null,
      liveGate: gate,
      liveAvailable: false,
      liveNote: gate.note,
      demo,
      live,
      mt5LoginBridge: "not_implemented",
      note: "Demo connection testing only. Live credentials may be stored encrypted but Live activation is locked.",
      // Flat Demo compatibility fields
      environment: "demo",
      loginConfigured: demo.loginConfigured,
      passwordConfigured: demo.passwordConfigured,
      serverConfigured: demo.serverConfigured,
      configured: demo.configured,
      loginHint: demo.loginHint,
      server: demo.server,
      credentialsUpdatedAt: demo.credentialsUpdatedAt,
      connectionStatus: demo.connectionStatus,
      lastAuthStatus: demo.lastAuthStatus,
      lastAuthAt: demo.lastAuthAt,
      lastAuthError: demo.lastAuthError,
      lastSyncAt: demo.lastSyncAt,
      lastProbeAt: demo.lastProbeAt,
      lastProbeSummary: demo.lastProbeSummary,
      account: demo.account,
      allowedServers: demo.allowedServers,
    };
  }

  private async persistMeta(env: Mt5HfmEnvironment): Promise<void> {
    const dir = path.join(this.storageRoot, "mt5-hfm");
    const target = path.join(dir, metaFileName(env));
    const temporary = `${target}.${Date.now()}.tmp`;
    const file = this.meta(env);
    const safe: EnvMetaFile = {
      login: file.login,
      server: file.server,
      credentialsUpdatedAt: file.credentialsUpdatedAt,
      connectionStatus: file.connectionStatus,
      lastAuthStatus: file.lastAuthStatus,
      lastAuthAt: file.lastAuthAt,
      lastAuthError: file.lastAuthError,
      lastSyncAt: file.lastSyncAt,
      lastProbeAt: file.lastProbeAt,
      lastProbeSummary: file.lastProbeSummary,
      account: file.account,
    };
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(temporary, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
      await fs.rename(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

let singleton: Mt5HfmDemoProfileManager | null = null;

export async function getMt5HfmDemoProfileManager(): Promise<Mt5HfmDemoProfileManager> {
  if (!singleton) {
    singleton = new Mt5HfmDemoProfileManager();
    await singleton.initialize();
  }
  return singleton;
}

export function createMt5HfmDemoProfileManager(): Mt5HfmDemoProfileManager {
  return new Mt5HfmDemoProfileManager();
}

export function resetMt5HfmDemoProfileManagerForTests(): void {
  singleton = null;
}
