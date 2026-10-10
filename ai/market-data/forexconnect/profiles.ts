/**
 * Phase 36 — Isolated DEMO / LIVE ForexConnect credential profiles.
 * Passwords: AES-GCM via AiSecretsManager (never returned to HTTP clients).
 * Usernames + status metadata: local profiles.json (no passwords).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { AiSecretsManager } from "../../connector-management/secrets-manager.js";
import { maskCredential } from "../../admin-control-plane/admin-auth-boundary.js";
import type { ForexConnectEnvironment } from "./config.js";

export type ForexConnectUiEnvironment = "demo" | "live";

export interface ForexConnectProfilePublic {
  environment: ForexConnectUiEnvironment;
  sdkEnvironment: ForexConnectEnvironment;
  label: "DEMO" | "LIVE";
  usernameConfigured: boolean;
  passwordConfigured: boolean;
  usernameHint: string | null;
  configured: boolean;
  lastAuthStatus: string | null;
  lastAuthAt: string | null;
  lastAuthError: string | null;
  lastInstrumentCount: number | null;
  lastInstrumentAt: string | null;
  lastConnectedAt: string | null;
}

export interface ForexConnectProfilesPublicState {
  ok: true;
  vaultUnlocked: boolean;
  storageMode: "encrypted-vault" | "memory-only";
  persistenceWarning: string | null;
  preferredEnvironment: ForexConnectUiEnvironment;
  activeEnvironment: ForexConnectUiEnvironment | null;
  activeSessionStatus: string | null;
  profiles: {
    demo: ForexConnectProfilePublic;
    live: ForexConnectProfilePublic;
  };
  note: string;
}

interface ProfileMeta {
  username: string;
  lastAuthStatus: string | null;
  lastAuthAt: string | null;
  lastAuthError: string | null;
  lastInstrumentCount: number | null;
  lastInstrumentAt: string | null;
  lastConnectedAt: string | null;
}

interface ProfilesFile {
  preferredEnvironment: ForexConnectUiEnvironment;
  profiles: {
    demo: ProfileMeta;
    live: ProfileMeta;
  };
}

function emptyMeta(): ProfileMeta {
  return {
    username: "",
    lastAuthStatus: null,
    lastAuthAt: null,
    lastAuthError: null,
    lastInstrumentCount: null,
    lastInstrumentAt: null,
    lastConnectedAt: null,
  };
}

function defaultFile(): ProfilesFile {
  return {
    preferredEnvironment: "demo",
    profiles: { demo: emptyMeta(), live: emptyMeta() },
  };
}

export function uiEnvToSdk(env: ForexConnectUiEnvironment): ForexConnectEnvironment {
  return env === "live" ? "real" : "demo";
}

export function parseUiEnvironment(raw: unknown): ForexConnectUiEnvironment | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "demo") return "demo";
  if (v === "live" || v === "real") return "live";
  return null;
}

function secretId(env: ForexConnectUiEnvironment): string {
  return `forexconnect:${env}:password`;
}

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export class ForexConnectProfilesManager {
  private storageRoot = "";
  private secrets: AiSecretsManager | null = null;
  private memoryPasswords = new Map<ForexConnectUiEnvironment, string>();
  private file: ProfilesFile = defaultFile();
  private activeEnvironment: ForexConnectUiEnvironment | null = null;
  private activeSessionStatus: string | null = null;
  private initialized = false;

  async initialize(storageRoot = resolveStorageRoot()): Promise<void> {
    this.storageRoot = storageRoot;
    const root = path.join(storageRoot, "forexconnect");
    await fs.mkdir(root, { recursive: true });
    try {
      const secrets = new AiSecretsManager();
      await secrets.initialize(storageRoot);
      this.secrets = secrets;
    } catch {
      this.secrets = null;
    }
    try {
      const raw = await fs.readFile(path.join(root, "profiles.json"), "utf8");
      const parsed = JSON.parse(raw) as ProfilesFile;
      this.file = {
        preferredEnvironment: parsed.preferredEnvironment === "live" ? "live" : "demo",
        profiles: {
          demo: { ...emptyMeta(), ...(parsed.profiles?.demo ?? {}) },
          live: { ...emptyMeta(), ...(parsed.profiles?.live ?? {}) },
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.file = defaultFile();
    }
    this.initialized = true;
  }

  ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("ForexConnect profiles manager is not initialized");
    }
  }

  vaultUnlocked(): boolean {
    return Boolean(this.secrets?.isUnlocked());
  }

  storageMode(): "encrypted-vault" | "memory-only" {
    return this.vaultUnlocked() ? "encrypted-vault" : "memory-only";
  }

  async saveCredentials(
    env: ForexConnectUiEnvironment,
    input: { username: string; password: string },
  ): Promise<ForexConnectProfilePublic> {
    this.ensureInitialized();
    const username = String(input.username ?? "").trim();
    const password = String(input.password ?? "").trim();
    if (!username) throw new Error("Username is required");
    if (password.length < 4) throw new Error("Password must be at least 4 characters");

    this.file.profiles[env].username = username;

    if (this.vaultUnlocked() && this.secrets) {
      await this.secrets.set(secretId(env), password);
      this.memoryPasswords.delete(env);
    } else {
      this.memoryPasswords.set(env, password);
    }
    await this.persistMeta();
    return this.publicProfile(env);
  }

  async clearPassword(env: ForexConnectUiEnvironment): Promise<void> {
    this.ensureInitialized();
    this.memoryPasswords.delete(env);
    if (this.secrets?.has(secretId(env))) {
      await this.secrets.remove(secretId(env));
    }
    await this.persistMeta();
  }

  getCredentials(env: ForexConnectUiEnvironment): {
    username: string;
    password: string;
    sdkEnvironment: ForexConnectEnvironment;
  } | null {
    this.ensureInitialized();
    const username = this.file.profiles[env].username.trim();
    let password = "";
    if (this.vaultUnlocked() && this.secrets?.has(secretId(env))) {
      password = this.secrets.get(secretId(env));
    } else {
      password = this.memoryPasswords.get(env) ?? "";
    }
    // Env fallback for ops (single shared env — only when profile incomplete)
    if (!username || password.length < 4) {
      const envUser = String(process.env.KWIZERA_FOREXCONNECT_USERNAME ?? "").trim();
      const envPass = String(process.env.KWIZERA_FOREXCONNECT_PASSWORD ?? "").trim();
      const envEnv = String(process.env.KWIZERA_FOREXCONNECT_ENVIRONMENT ?? "demo").toLowerCase();
      const envIsLive = envEnv === "real" || envEnv === "live" || envEnv === "production" || envEnv === "prod";
      const matches = (env === "live" && envIsLive) || (env === "demo" && !envIsLive);
      if (matches && envUser && envPass.length >= 4) {
        return { username: envUser, password: envPass, sdkEnvironment: uiEnvToSdk(env) };
      }
      return null;
    }
    return { username, password, sdkEnvironment: uiEnvToSdk(env) };
  }

  setPreferredEnvironment(env: ForexConnectUiEnvironment): void {
    this.file.preferredEnvironment = env;
  }

  async persistPreferred(env: ForexConnectUiEnvironment): Promise<void> {
    this.setPreferredEnvironment(env);
    await this.persistMeta();
  }

  setActiveSession(env: ForexConnectUiEnvironment | null, status: string | null): void {
    this.activeEnvironment = env;
    this.activeSessionStatus = status;
  }

  getActiveEnvironment(): ForexConnectUiEnvironment | null {
    return this.activeEnvironment;
  }

  async recordAuthResult(
    env: ForexConnectUiEnvironment,
    result: {
      status: string;
      errorMessage?: string | null;
      instrumentCount?: number | null;
      connectedAt?: string | null;
      instrumentAt?: string | null;
    },
  ): Promise<void> {
    const meta = this.file.profiles[env];
    meta.lastAuthStatus = result.status;
    meta.lastAuthAt = new Date().toISOString();
    meta.lastAuthError = result.errorMessage ? String(result.errorMessage).slice(0, 400) : null;
    if (result.instrumentCount != null) meta.lastInstrumentCount = result.instrumentCount;
    if (result.instrumentAt) meta.lastInstrumentAt = result.instrumentAt;
    if (result.connectedAt) meta.lastConnectedAt = result.connectedAt;
    await this.persistMeta();
  }

  publicProfile(env: ForexConnectUiEnvironment): ForexConnectProfilePublic {
    const meta = this.file.profiles[env];
    let pwdOk = Boolean(
      (this.vaultUnlocked() && this.secrets?.has(secretId(env)))
      || this.memoryPasswords.has(env),
    );
    let usernameOk = Boolean(meta.username.trim());
    if (!pwdOk || !usernameOk) {
      const creds = this.getCredentials(env);
      if (creds) {
        pwdOk = true;
        usernameOk = true;
      }
    }
    return {
      environment: env,
      sdkEnvironment: uiEnvToSdk(env),
      label: env === "live" ? "LIVE" : "DEMO",
      usernameConfigured: usernameOk,
      passwordConfigured: pwdOk,
      usernameHint: meta.username ? maskCredential(meta.username) : (usernameOk ? "••••••••" : null),
      configured: usernameOk && pwdOk,
      lastAuthStatus: meta.lastAuthStatus,
      lastAuthAt: meta.lastAuthAt,
      lastAuthError: meta.lastAuthError,
      lastInstrumentCount: meta.lastInstrumentCount,
      lastInstrumentAt: meta.lastInstrumentAt,
      lastConnectedAt: meta.lastConnectedAt,
    };
  }

  publicState(): ForexConnectProfilesPublicState {
    this.ensureInitialized();
    const mode = this.storageMode();
    return {
      ok: true,
      vaultUnlocked: this.vaultUnlocked(),
      storageMode: mode,
      persistenceWarning: mode === "memory-only"
        ? "Secrets vault locked or unavailable. Passwords are held in process memory only and are lost on restart. Set KWIZERA_SECRETS_PASSPHRASE to enable encrypted persistence."
        : null,
      preferredEnvironment: this.file.preferredEnvironment,
      activeEnvironment: this.activeEnvironment,
      activeSessionStatus: this.activeSessionStatus,
      profiles: {
        demo: this.publicProfile("demo"),
        live: this.publicProfile("live"),
      },
      note: "DEMO and LIVE credentials are isolated. Passwords are never returned.",
    };
  }

  private async persistMeta(): Promise<void> {
    const dir = path.join(this.storageRoot, "forexconnect");
    const target = path.join(dir, "profiles.json");
    const temporary = `${target}.${Date.now()}.tmp`;
    // Never write passwords into this file.
    const safe: ProfilesFile = {
      preferredEnvironment: this.file.preferredEnvironment,
      profiles: {
        demo: { ...this.file.profiles.demo },
        live: { ...this.file.profiles.live },
      },
    };
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(temporary, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
      await fs.rename(temporary, target);
    } catch (error) {
      // Tests may tear down the temp root while a prior write is in flight.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }
}

let singleton: ForexConnectProfilesManager | null = null;

export async function getForexConnectProfilesManager(): Promise<ForexConnectProfilesManager> {
  if (!singleton) {
    singleton = new ForexConnectProfilesManager();
    await singleton.initialize();
  }
  return singleton;
}

export function createForexConnectProfilesManager(): ForexConnectProfilesManager {
  return new ForexConnectProfilesManager();
}

export function resetForexConnectProfilesManagerForTests(): void {
  singleton = null;
}
