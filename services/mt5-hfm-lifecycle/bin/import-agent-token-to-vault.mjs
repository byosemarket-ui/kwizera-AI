#!/usr/bin/env node
/**
 * Import /run/kwizera/mt5-hfm-agent.token into the encrypted vault as mt5-hfm:agent:token.
 * Never prints the token. Use when the runtime token was generated first.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SECRET_ID = "mt5-hfm:agent:token";
const TOKEN_FILE = process.env.KWIZERA_MT5_HFM_AGENT_TOKEN_FILE || "/run/kwizera/mt5-hfm-agent.token";
const root = process.env.KWIZERA_APP_ROOT || process.cwd();
const storageRoot = process.env.KWIZERA_STORAGE_ROOT || join(root, "data");

const token = readFileSync(TOKEN_FILE, "utf8").trim();
if (token.length < 16) {
  console.error("token_too_short");
  process.exit(1);
}

const modPath = join(root, "dist/ai/connector-management/secrets-manager.js");
const { AiSecretsManager } = await import(pathToFileURL(modPath).href);
const secrets = new AiSecretsManager();
await secrets.initialize(storageRoot);
if (!secrets.isUnlocked()) {
  console.error("vault_locked");
  process.exit(2);
}
await secrets.set(SECRET_ID, token);
console.log(`agent_token_imported_to_vault id=${SECRET_ID} hint=****${token.slice(-4)}`);
