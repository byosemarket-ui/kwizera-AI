/**
 * Append-only credential action audit for HFM MT5 Demo.
 * Never records passwords, request bodies, or secret material.
 */
import fs from "node:fs/promises";
import path from "node:path";

export type Mt5HfmCredentialAuditAction =
  | "auth_check"
  | "save"
  | "clear"
  | "test_connection"
  | "status_read"
  | "account_read";

export interface Mt5HfmCredentialAuditEvent {
  at: string;
  action: Mt5HfmCredentialAuditAction;
  ok: boolean;
  code?: string;
  /** Masked or truncated login hint only — never full password. */
  loginHint?: string | null;
  server?: string | null;
  remoteAddress?: string | null;
  path?: string;
  detail?: string;
}

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

function sanitizeDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  // Strip anything that looks like a long secret-bearing token.
  return detail.replace(/[A-Za-z0-9+/=_-]{24,}/g, "[redacted]").slice(0, 240);
}

export async function appendMt5HfmCredentialAudit(
  event: Omit<Mt5HfmCredentialAuditEvent, "at"> & { at?: string },
): Promise<void> {
  const entry: Mt5HfmCredentialAuditEvent = {
    at: event.at ?? new Date().toISOString(),
    action: event.action,
    ok: event.ok,
    code: event.code,
    loginHint: event.loginHint ?? null,
    server: event.server ?? null,
    remoteAddress: event.remoteAddress ?? null,
    path: event.path,
    detail: sanitizeDetail(event.detail),
  };

  // Defense: refuse to persist accidental password-shaped fields.
  const serialized = JSON.stringify(entry);
  if (/"password"\s*:/i.test(serialized)) {
    return;
  }

  const dir = path.join(resolveStorageRoot(), "mt5-hfm");
  const target = path.join(dir, "credential-audit.jsonl");
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(target, `${serialized}\n`, "utf8");
  } catch {
    // Audit must not break credential flows.
  }
}
