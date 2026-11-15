#!/usr/bin/env node
/**
 * Export mt5-hfm:agent:token from encrypted vault to runtime token file.
 * Never prints the token. Run as kwizera on the VPS after deploy.
 *
 * Usage:
 *   node services/mt5-hfm-lifecycle/bin/export-agent-token-from-vault.mjs
 */
import { writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { AiSecretsManager } from "../../../ai/connector-management/secrets-manager.js";

const SECRET_ID = "mt5-hfm:agent:token";
const TOKEN_FILE = process.env.KWIZERA_MT5_HFM_AGENT_TOKEN_FILE || "/run/kwizera/mt5-hfm-agent.token";
const storageRoot = process.env.KWIZERA_STORAGE_ROOT || `${process.cwd()}/data`;

const secrets = new AiSecretsManager();
await secrets.initialize(storageRoot);
if (!secrets.isUnlocked()) {
  console.error("vault_locked");
  process.exit(1);
}
if (!secrets.has(SECRET_ID)) {
  const token = randomBytes(32).toString("base64url");
  await secrets.set(SECRET_ID, token);
}
const token = secrets.get(SECRET_ID);
mkdirSync(dirname(TOKEN_FILE), { recursive: true, mode: 0o755 });
writeFileSync(TOKEN_FILE, token, { encoding: "utf8", mode: 0o640 });
chmodSync(TOKEN_FILE, 0o640);
console.log(`agent_token_exported path=${TOKEN_FILE} hint=****${token.slice(-4)}`);
