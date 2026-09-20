/**
 * Admin credential architecture.
 * Secrets live in AiSecretsManager (AES-GCM). The registry stores only a reference id.
 * Secrets are never returned to HTTP clients, logs, or the Admin UI.
 */
import { createHash } from "node:crypto";
import type { AiSecretsManager } from "../connector-management/secrets-manager.js";
import { maskCredential } from "./admin-auth-boundary.js";
import { AdminValidationError, ADMIN_ERROR_CODES } from "./validation.js";

export interface CredentialPublicStatus {
  configured: boolean;
  display: string | null;
  unlocked: boolean;
}

export function credentialReferenceFor(providerId: string): string {
  return `admin-provider:${providerId}`;
}

export class AdminCredentialManager {
  private secrets: AiSecretsManager | null = null;

  attach(secrets: AiSecretsManager): void {
    this.secrets = secrets;
  }

  isAttached(): boolean {
    return Boolean(this.secrets);
  }

  isUnlocked(): boolean {
    return Boolean(this.secrets?.isUnlocked());
  }

  has(providerId: string): boolean {
    const ref = credentialReferenceFor(providerId);
    return Boolean(this.secrets?.has(ref));
  }

  status(providerId: string, hint?: string | null): CredentialPublicStatus {
    const configured = this.has(providerId) || Boolean(hint);
    return {
      configured,
      display: configured ? (hint ? maskCredential(hint) : "••••••••") : null,
      unlocked: this.isUnlocked(),
    };
  }

  /**
   * Store a provider secret. Returns a public hint (last-4) — never the secret.
   */
  async setProviderSecret(providerId: string, secret: string): Promise<{ hint: string }> {
    if (!this.secrets) {
      throw new AdminValidationError(ADMIN_ERROR_CODES.CREDENTIAL_LOCKED, "Credential manager is not attached");
    }
    if (!this.secrets.isUnlocked()) {
      throw new AdminValidationError(
        ADMIN_ERROR_CODES.CREDENTIAL_LOCKED,
        "Secrets Manager is locked; set KWIZERA_SECRETS_PASSPHRASE before storing provider credentials",
      );
    }
    const value = secret.trim();
    if (!value) {
      throw new AdminValidationError(ADMIN_ERROR_CODES.CREDENTIAL_REQUIRED, "Credential value is required");
    }
    await this.secrets.set(credentialReferenceFor(providerId), value);
    return { hint: publicHint(value) };
  }

  async clearProviderSecret(providerId: string): Promise<void> {
    if (!this.secrets) return;
    await this.secrets.remove(credentialReferenceFor(providerId));
  }

  /**
   * Runtime-only decrypt. Never call from Admin HTTP handlers that return JSON to browsers.
   */
  getProviderSecret(providerId: string): string | undefined {
    if (!this.secrets?.has(credentialReferenceFor(providerId))) return undefined;
    return this.secrets.get(credentialReferenceFor(providerId));
  }
}

function publicHint(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return "••••";
  return trimmed.slice(-4);
}

/** Fingerprint for change detection — not reversible to the secret. */
export function credentialFingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 12);
}
