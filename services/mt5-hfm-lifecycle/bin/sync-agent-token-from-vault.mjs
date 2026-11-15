#!/usr/bin/env node
/**
 * Export mt5-hfm:agent:token from the encrypted vault to a 0600 temp file.
 * Prints ONLY the temp file path (never the token). Used by provision-agent-token.sh.
 *
 * Usage (as kwizera, cwd=/opt/kwizera-ai):
 *   node services/mt5-hfm-lifecycle/bin/sync-agent-token-from-vault.mjs
 */
import { randomBytes, writeFileSync, openSync, writeSync, closeSync, fchmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SECRET_ID = "mt5-hfm:agent:token";

async function main() {
  const root = process.env.KWIZERA_APP_ROOT || process.cwd();
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT || join(root, "data");
  const modPath = join(root, "dist/ai/connector-management/secrets-manager.js");
  const { AiSecretsManager } = await import(pathToFileURL(modPath).href);
  const secrets = new AiSecretsManager();
  await secrets.initialize(storageRoot);
  if (!secrets.isUnlocked()) {
    console.error("vault_locked");
    process.exit(2);
  }
  if (!secrets.has(SECRET_ID)) {
    const token = randomBytes(32).toString("base64url");
    await secrets.set(SECRET_ID, token);
  }
  const token = secrets.get(SECRET_ID);
  const out = join(tmpdir(), `kwizera-mt5-agent-token-${process.pid}.tmp`);
  const fd = openSync(out, "w", 0o600);
  try {
    writeSync(fd, token, undefined, "utf8");
    fchmodSync(fd, 0o600);
  } finally {
    closeSync(fd);
  }
  // Path only — never the secret.
  process.stdout.write(out);
}

main().catch((err) => {
  console.error("sync_failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
