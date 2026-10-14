/**
 * Secure OpenAI provider configuration for Forex Admin (Phase 43E).
 * API key encrypted with AES-256-GCM using KWIZERA_SECRETS_PASSPHRASE (never returned).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import { isOpenAiChatEligibleModel } from "./model-policy.js";
import type { OpenAiDiscoveredModelPublic, OpenAiProviderPublicStatus } from "./types.js";

export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
export const OPENAI_SECRET_ID = "forex-openai-api-key";
/** Discovery cache TTL — not indefinite; refresh is still explicit. */
export const OPENAI_MODELS_CACHE_TTL_MS = 15 * 60_000;

interface EncryptedBlob {
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface SecretsFile {
  version: 1;
  secretId: string;
  blob: EncryptedBlob | null;
  updatedAt: string | null;
}

interface PublicConfigFile {
  version: 1;
  model: string;
  updatedAt: string | null;
  lastValidatedAt: string | null;
  lastValidationStatus: "never" | "ok" | "error" | null;
  lastVerificationNote: string | null;
}

interface ModelsCacheFile {
  version: 1;
  discoveredAt: string | null;
  models: OpenAiDiscoveredModelPublic[];
}

const EMPTY_SECRETS: SecretsFile = {
  version: 1,
  secretId: OPENAI_SECRET_ID,
  blob: null,
  updatedAt: null,
};

const EMPTY_PUBLIC: PublicConfigFile = {
  version: 1,
  model: OPENAI_DEFAULT_MODEL,
  updatedAt: null,
  lastValidatedAt: null,
  lastValidationStatus: "never",
  lastVerificationNote: null,
};

const EMPTY_MODELS: ModelsCacheFile = {
  version: 1,
  discoveredAt: null,
  models: [],
};

function passphrase(): string | null {
  const value = String(process.env.KWIZERA_SECRETS_PASSPHRASE ?? "").trim();
  return value || null;
}

function deriveKey(pass: string, salt: Buffer): Buffer {
  return scryptSync(pass, salt, 32);
}

function encryptValue(pass: string, value: string): EncryptedBlob {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(pass, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptValue(pass: string, blob: EncryptedBlob): string {
  const key = deriveKey(pass, Buffer.from(blob.salt, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Format-only sanitize for reads. Never replaces a valid saved id with a hardcoded fallback. */
function sanitizeModelId(raw: unknown): string {
  const model = String(raw ?? "").trim();
  if (!/^[a-zA-Z0-9._:-]{3,64}$/.test(model)) return OPENAI_DEFAULT_MODEL;
  return model;
}

function assertEligibleModel(raw: unknown): string {
  const model = String(raw ?? "").trim();
  if (!/^[a-zA-Z0-9._:-]{3,64}$/.test(model)) {
    throw Object.assign(new Error("Invalid OpenAI model identifier."), {
      code: "INVALID_MODEL",
    });
  }
  if (!isOpenAiChatEligibleModel(model)) {
    throw Object.assign(
      new Error(
        `Model "${model}" is not eligible for Forex snapshot chat analysis.`,
      ),
      { code: "MODEL_NOT_ELIGIBLE" },
    );
  }
  return model;
}

export class ForexOpenAiConfigStore {
  private readonly dir: string;
  private readonly secretsPath: string;
  private readonly publicPath: string;
  private readonly modelsPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storageRoot?: string) {
    this.dir = path.join(storageRoot ?? resolveStorageRoot(), "forex-openai");
    this.secretsPath = path.join(this.dir, "secrets.json");
    this.publicPath = path.join(this.dir, "config.json");
    this.modelsPath = path.join(this.dir, "models-cache.json");
  }

  async ensureReady(): Promise<void> {
    fs.mkdirSync(this.dir, { recursive: true });
    if (!fs.existsSync(this.secretsPath)) {
      await writeJsonAtomic(this.secretsPath, EMPTY_SECRETS);
    }
    if (!fs.existsSync(this.publicPath)) {
      await writeJsonAtomic(this.publicPath, EMPTY_PUBLIC);
    }
    if (!fs.existsSync(this.modelsPath)) {
      await writeJsonAtomic(this.modelsPath, EMPTY_MODELS);
    }
  }

  isVaultUnlocked(): boolean {
    return Boolean(passphrase());
  }

  private readSecrets(): SecretsFile {
    const result = readJsonSafeSync<SecretsFile>(this.secretsPath, EMPTY_SECRETS);
    const value = result.value ?? EMPTY_SECRETS;
    return {
      version: 1,
      secretId: OPENAI_SECRET_ID,
      blob: value.blob ?? null,
      updatedAt: value.updatedAt ?? null,
    };
  }

  private readPublic(): PublicConfigFile {
    const result = readJsonSafeSync<PublicConfigFile>(this.publicPath, EMPTY_PUBLIC);
    const value = result.value ?? EMPTY_PUBLIC;
    return {
      version: 1,
      model: sanitizeModelId(value.model),
      updatedAt: value.updatedAt ?? null,
      lastValidatedAt: value.lastValidatedAt ?? null,
      lastValidationStatus: value.lastValidationStatus ?? "never",
      lastVerificationNote: value.lastVerificationNote ?? null,
    };
  }

  private readModelsCache(): ModelsCacheFile {
    const result = readJsonSafeSync<ModelsCacheFile>(this.modelsPath, EMPTY_MODELS);
    const value = result.value ?? EMPTY_MODELS;
    return {
      version: 1,
      discoveredAt: value.discoveredAt ?? null,
      models: Array.isArray(value.models) ? value.models : [],
    };
  }

  async getPublicStatus(): Promise<OpenAiProviderPublicStatus> {
    await this.ensureReady();
    const secrets = this.readSecrets();
    const pub = this.readPublic();
    const cache = this.readModelsCache();
    const unlocked = this.isVaultUnlocked();
    const configured = Boolean(secrets.blob);
    const modelEligible = isOpenAiChatEligibleModel(pub.model);
    const verificationDisplay =
      pub.lastValidationStatus === "ok"
        ? "VERIFIED" as const
        : pub.lastValidationStatus === "error"
          ? "VERIFICATION_FAILED" as const
          : "NOT_VERIFIED" as const;
    return {
      configured,
      vaultUnlocked: unlocked,
      model: pub.model,
      modelEligible,
      updatedAt: secrets.updatedAt ?? pub.updatedAt,
      lastValidatedAt: pub.lastValidatedAt,
      lastValidationStatus: pub.lastValidationStatus,
      verificationDisplay,
      lastVerificationNote: pub.lastVerificationNote,
      modelsDiscoveredAt: cache.discoveredAt,
      eligibleModelCount: cache.discoveredAt
        ? cache.models.filter((m) => m.eligible).length
        : null,
      note: !unlocked
        ? "Secret vault locked — set KWIZERA_SECRETS_PASSPHRASE on the server."
        : !configured
          ? "OpenAI API key is not configured."
          : !modelEligible
            ? `Saved model "${pub.model}" is not eligible for chat analysis — update the model.`
            : verificationDisplay === "VERIFIED"
              ? "OpenAI API key is configured and last verification succeeded (value never returned)."
              : verificationDisplay === "VERIFICATION_FAILED"
                ? "OpenAI API key is configured but last verification failed."
                : "OpenAI API key is configured but not verified (value never returned).",
    };
  }

  async setApiKey(apiKey: string, model?: string): Promise<OpenAiProviderPublicStatus> {
    const pass = passphrase();
    if (!pass) {
      throw Object.assign(new Error("Secret vault is locked. Set KWIZERA_SECRETS_PASSPHRASE."), {
        code: "SECRETS_VAULT_LOCKED",
      });
    }
    const key = String(apiKey ?? "").trim();
    if (!key || key.length < 20 || key.length > 256) {
      throw Object.assign(new Error("OpenAI API key looks invalid."), {
        code: "INVALID_API_KEY",
      });
    }
    if (!key.startsWith("sk-")) {
      throw Object.assign(new Error("OpenAI API key format is not accepted."), {
        code: "INVALID_API_KEY",
      });
    }

    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const now = new Date().toISOString();
      const secrets: SecretsFile = {
        version: 1,
        secretId: OPENAI_SECRET_ID,
        blob: encryptValue(pass, key),
        updatedAt: now,
      };
      const pub = this.readPublic();
      const nextModel = model != null ? assertEligibleModel(model) : pub.model;
      const nextPublic: PublicConfigFile = {
        version: 1,
        model: nextModel,
        updatedAt: now,
        // Saving a new key invalidates prior verification.
        lastValidatedAt: null,
        lastValidationStatus: "never",
        lastVerificationNote: "Key updated — run Verify connection.",
      };
      await writeJsonAtomic(this.secretsPath, secrets);
      await writeJsonAtomic(this.publicPath, nextPublic);
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
    return this.getPublicStatus();
  }

  async setModel(model: string): Promise<OpenAiProviderPublicStatus> {
    const nextModel = assertEligibleModel(model);
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const pub = this.readPublic();
      const next: PublicConfigFile = {
        ...pub,
        model: nextModel,
        updatedAt: new Date().toISOString(),
      };
      await writeJsonAtomic(this.publicPath, next);
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
    return this.getPublicStatus();
  }

  async saveDiscoveredModels(models: OpenAiDiscoveredModelPublic[]): Promise<void> {
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const payload: ModelsCacheFile = {
        version: 1,
        discoveredAt: new Date().toISOString(),
        models: models.map((m) => ({
          id: String(m.id),
          created: m.created ?? null,
          ownedBy: m.ownedBy ?? null,
          eligible: Boolean(m.eligible),
          source: m.source ?? null,
          gpt6Family: Boolean(
            m.gpt6Family ?? String(m.id).toLowerCase().startsWith("gpt-6"),
          ),
        })),
      };
      await writeJsonAtomic(this.modelsPath, payload);
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
  }

  async getDiscoveredModels(): Promise<{
    discoveredAt: string | null;
    stale: boolean;
    models: OpenAiDiscoveredModelPublic[];
  }> {
    await this.ensureReady();
    const cache = this.readModelsCache();
    const discoveredAt = cache.discoveredAt;
    let stale = true;
    if (discoveredAt) {
      const age = Date.now() - Date.parse(discoveredAt);
      stale = !Number.isFinite(age) || age > OPENAI_MODELS_CACHE_TTL_MS;
    }
    return {
      discoveredAt,
      stale,
      models: cache.models,
    };
  }

  async clearApiKey(): Promise<OpenAiProviderPublicStatus> {
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const now = new Date().toISOString();
      await writeJsonAtomic(this.secretsPath, {
        version: 1,
        secretId: OPENAI_SECRET_ID,
        blob: null,
        updatedAt: now,
      });
      const pub = this.readPublic();
      await writeJsonAtomic(this.publicPath, {
        ...pub,
        updatedAt: now,
        lastValidatedAt: null,
        lastValidationStatus: "never",
        lastVerificationNote: "API key cleared — verification reset.",
      });
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
    return this.getPublicStatus();
  }

  /** Server-only — never expose via HTTP. */
  async getApiKey(): Promise<string | null> {
    const pass = passphrase();
    if (!pass) {
      throw Object.assign(new Error("Secret vault is locked."), { code: "SECRETS_VAULT_LOCKED" });
    }
    await this.ensureReady();
    const secrets = this.readSecrets();
    if (!secrets.blob) return null;
    try {
      return decryptValue(pass, secrets.blob);
    } catch {
      throw Object.assign(new Error("Failed to decrypt OpenAI API key."), {
        code: "SECRET_DECRYPT_FAILED",
      });
    }
  }

  async getModel(): Promise<string> {
    await this.ensureReady();
    return this.readPublic().model;
  }

  async recordValidation(ok: boolean, note?: string | null): Promise<void> {
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const pub = this.readPublic();
      const safeNote = note
        ? String(note).replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 240)
        : ok
          ? "Bounded Chat Completions JSON verification succeeded."
          : "Bounded verification failed.";
      await writeJsonAtomic(this.publicPath, {
        ...pub,
        lastValidatedAt: new Date().toISOString(),
        lastValidationStatus: ok ? "ok" : "error",
        lastVerificationNote: safeNote,
      });
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    await run;
  }

  /** Deterministic fingerprint of key presence (not the key). */
  async configuredFingerprint(): Promise<string | null> {
    await this.ensureReady();
    const secrets = this.readSecrets();
    if (!secrets.blob) return null;
    return createHash("sha256")
      .update(secrets.blob.ciphertext)
      .digest("hex")
      .slice(0, 16);
  }
}

let singleton: ForexOpenAiConfigStore | null = null;

export function getForexOpenAiConfigStore(): ForexOpenAiConfigStore {
  singleton ??= new ForexOpenAiConfigStore();
  return singleton;
}

export function createForexOpenAiConfigStore(storageRoot?: string): ForexOpenAiConfigStore {
  return new ForexOpenAiConfigStore(storageRoot);
}

export function resetForexOpenAiConfigStoreForTests(): void {
  singleton = null;
}
