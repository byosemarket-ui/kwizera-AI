/**
 * HFM MT5 Demo Connection Manager — credential metadata + vault.
 * Password: AES-256-GCM via AiSecretsManager id `mt5-hfm:demo:password`.
 * Metadata: `{storageRoot}/mt5-hfm/demo-profile.json` (never passwords).
 * LIVE credentials are intentionally unsupported in this phase.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { AiSecretsManager } from "../../connector-management/secrets-manager.js";
import { maskCredential } from "../../admin-control-plane/admin-auth-boundary.js";

export const MT5_HFM_DEMO_PASSWORD_SECRET_ID = "mt5-hfm:demo:password";

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

export type HfmDemoServerName = (typeof HFM_DEMO_SERVER_ALLOWLIST)[number] | string;

export interface Mt5HfmDemoAccountInfoPublic {
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

export interface Mt5HfmDemoPublicStatus {
  ok: true;
  environment: "demo";
  liveAvailable: false;
  liveNote: string;
  vaultUnlocked: boolean;
  storageMode: "encrypted-vault" | "unavailable";
  persistenceWarning: string | null;
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
  account: Mt5HfmDemoAccountInfoPublic | null;
  allowedServers: readonly string[];
  mt5LoginBridge: "not_implemented";
  note: string;
}

interface DemoMetaFile {
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
  account: Mt5HfmDemoAccountInfoPublic | null;
}

function emptyMeta(): DemoMetaFile {
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

export function normalizeHfmDemoServer(raw: unknown): string {
  return String(raw ?? "").trim();
}

export function isLiveLookingServer(server: string): boolean {
  return /live|real|prod/i.test(server);
}

export function validateDemoLogin(raw: unknown): string {
  const login = String(raw ?? "").trim();
  if (!login) throw new Error("Demo account number is required.");
  if (login.length < 4 || login.length > 32) {
    throw new Error("Demo account number must be 4–32 characters.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(login)) {
    throw new Error("Demo account number contains invalid characters.");
  }
  return login;
}

export function validateDemoServer(raw: unknown): string {
  const server = normalizeHfmDemoServer(raw);
  if (!server) throw new Error("Demo server name is required.");
  if (server.length < 3 || server.length > 64) {
    throw new Error("Demo server name must be 3–64 characters.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(server)) {
    throw new Error("Demo server name contains invalid characters.");
  }
  if (isLiveLookingServer(server)) {
    throw new Error("Live server names are not allowed. Demo servers only.");
  }
  return server;
}

export function validateDemoPassword(raw: unknown): string {
  const password = String(raw ?? "");
  if (password.length < 4) throw new Error("Password must be at least 4 characters.");
  if (password.length > 128) throw new Error("Password must be at most 128 characters.");
  if (/[\r\n\0]/.test(password)) throw new Error("Password contains invalid control characters.");
  return password;
}

export class Mt5HfmDemoProfileManager {
  private storageRoot = "";
  private secrets: AiSecretsManager | null = null;
  private file: DemoMetaFile = emptyMeta();
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
    try {
      const raw = await fs.readFile(path.join(root, "demo-profile.json"), "utf8");
      const parsed = JSON.parse(raw) as Partial<DemoMetaFile>;
      this.file = { ...emptyMeta(), ...parsed, login: String(parsed.login ?? ""), server: String(parsed.server ?? "") };
      // Never trust accidental password fields if present in old files.
      delete (this.file as { password?: unknown }).password;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.file = emptyMeta();
    }
    this.initialized = true;
  }

  ensureInitialized(): void {
    if (!this.initialized) throw new Error("MT5 HFM demo profile manager is not initialized");
  }

  vaultUnlocked(): boolean {
    return Boolean(this.secrets?.isUnlocked());
  }

  storageMode(): "encrypted-vault" | "unavailable" {
    return this.vaultUnlocked() ? "encrypted-vault" : "unavailable";
  }

  async saveCredentials(input: {
    login: string;
    server: string;
    password: string;
  }): Promise<Mt5HfmDemoPublicStatus> {
    this.ensureInitialized();
    const login = validateDemoLogin(input.login);
    const server = validateDemoServer(input.server);
    const password = validateDemoPassword(input.password);

    if (!this.vaultUnlocked() || !this.secrets) {
      throw new Error(
        "Encrypted vault is locked or unavailable. Set KWIZERA_SECRETS_PASSPHRASE on the server and restart. Credentials were not saved.",
      );
    }

    this.file.login = login;
    this.file.server = server;
    this.file.credentialsUpdatedAt = new Date().toISOString();
    this.file.connectionStatus = "credentials_saved";
    this.file.lastAuthError = null;
    // Account snapshot invalidated until a verified bridge sync.
    this.file.account = null;
    this.file.lastSyncAt = null;

    await this.secrets.set(MT5_HFM_DEMO_PASSWORD_SECRET_ID, password);
    if (!this.secrets.has(MT5_HFM_DEMO_PASSWORD_SECRET_ID)) {
      throw new Error("Credential vault write verification failed. Credentials were not saved.");
    }
    const stored = this.secrets.get(MT5_HFM_DEMO_PASSWORD_SECRET_ID);
    if (stored !== password) {
      throw new Error("Credential vault round-trip verification failed. Credentials were not saved.");
    }
    await this.persistMeta();
    return this.publicStatus();
  }

  async clearCredentials(): Promise<Mt5HfmDemoPublicStatus> {
    this.ensureInitialized();
    if (this.secrets?.has(MT5_HFM_DEMO_PASSWORD_SECRET_ID)) {
      await this.secrets.remove(MT5_HFM_DEMO_PASSWORD_SECRET_ID);
    }
    this.file = emptyMeta();
    this.file.connectionStatus = "cleared";
    await this.persistMeta();
    return this.publicStatus();
  }

  /** Runtime-only decrypt. Never call from GET handlers that return JSON to browsers. */
  getDemoPassword(): string | null {
    this.ensureInitialized();
    if (!this.vaultUnlocked() || !this.secrets?.has(MT5_HFM_DEMO_PASSWORD_SECRET_ID)) return null;
    try {
      const value = this.secrets.get(MT5_HFM_DEMO_PASSWORD_SECRET_ID);
      return value.length >= 4 ? value : null;
    } catch {
      return null;
    }
  }

  getDemoLoginMeta(): { login: string; server: string } | null {
    this.ensureInitialized();
    const login = this.file.login.trim();
    const server = this.file.server.trim();
    if (!login || !server) return null;
    return { login, server };
  }

  async recordProbeResult(result: {
    status: string;
    errorMessage?: string | null;
    summary?: string | null;
  }): Promise<void> {
    this.ensureInitialized();
    this.file.lastProbeAt = new Date().toISOString();
    this.file.lastProbeSummary = result.summary ? String(result.summary).slice(0, 400) : null;
    this.file.lastAuthStatus = result.status;
    this.file.lastAuthAt = this.file.lastProbeAt;
    this.file.lastAuthError = result.errorMessage ? String(result.errorMessage).slice(0, 400) : null;
    this.file.connectionStatus = result.status;
    await this.persistMeta();
  }

  publicStatus(): Mt5HfmDemoPublicStatus {
    this.ensureInitialized();
    const loginOk = Boolean(this.file.login.trim());
    const serverOk = Boolean(this.file.server.trim());
    const pwdOk = Boolean(this.vaultUnlocked() && this.secrets?.has(MT5_HFM_DEMO_PASSWORD_SECRET_ID));
    const mode = this.storageMode();
    return {
      ok: true,
      environment: "demo",
      liveAvailable: false,
      liveNote: "HFM Live login is disabled in this phase and is not available.",
      vaultUnlocked: this.vaultUnlocked(),
      storageMode: mode,
      persistenceWarning: mode === "unavailable"
        ? "Secrets vault locked or unavailable. Set KWIZERA_SECRETS_PASSPHRASE to enable encrypted Demo credential persistence."
        : null,
      loginConfigured: loginOk,
      passwordConfigured: pwdOk,
      serverConfigured: serverOk,
      configured: loginOk && serverOk && pwdOk,
      loginHint: this.file.login ? maskCredential(this.file.login) : null,
      server: this.file.server || null,
      credentialsUpdatedAt: this.file.credentialsUpdatedAt,
      connectionStatus: this.file.connectionStatus,
      lastAuthStatus: this.file.lastAuthStatus,
      lastAuthAt: this.file.lastAuthAt,
      lastAuthError: this.file.lastAuthError,
      lastSyncAt: this.file.lastSyncAt,
      lastProbeAt: this.file.lastProbeAt,
      lastProbeSummary: this.file.lastProbeSummary,
      account: this.file.account,
      allowedServers: HFM_DEMO_SERVER_ALLOWLIST,
      mt5LoginBridge: "not_implemented",
      note: "Demo credentials only. Passwords are never returned. MT5 terminal login bridge is designed but not enabled yet.",
    };
  }

  private async persistMeta(): Promise<void> {
    const dir = path.join(this.storageRoot, "mt5-hfm");
    const target = path.join(dir, "demo-profile.json");
    const temporary = `${target}.${Date.now()}.tmp`;
    const safe: DemoMetaFile = {
      login: this.file.login,
      server: this.file.server,
      credentialsUpdatedAt: this.file.credentialsUpdatedAt,
      connectionStatus: this.file.connectionStatus,
      lastAuthStatus: this.file.lastAuthStatus,
      lastAuthAt: this.file.lastAuthAt,
      lastAuthError: this.file.lastAuthError,
      lastSyncAt: this.file.lastSyncAt,
      lastProbeAt: this.file.lastProbeAt,
      lastProbeSummary: this.file.lastProbeSummary,
      account: this.file.account,
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
