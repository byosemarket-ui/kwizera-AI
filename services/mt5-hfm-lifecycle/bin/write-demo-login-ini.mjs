#!/usr/bin/env node
/**
 * Write a short-lived MT5 Demo login .ini from the encrypted vault.
 * Never prints the password. Never puts secrets on argv beyond Node itself.
 *
 * Usage (as kwizera; vault unlocked via env / .env):
 *   node write-demo-login-ini.mjs
 *   node write-demo-login-ini.mjs --validate   # write+shred immediately; no terminal start
 *
 * Outputs only non-secret lines:
 *   INI_BASENAME=login-….ini
 *   LOGIN_HINT=••••3799
 *   SERVER=HFMarketsGlobal-Demo
 *   EXPERT=1|0
 */
import { readFileSync, writeFileSync, chmodSync, mkdirSync, unlinkSync, existsSync, openSync, writeSync, closeSync, fsyncSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.KWIZERA_APP_ROOT || "/opt/kwizera-ai";
const storageRoot = process.env.KWIZERA_STORAGE_ROOT || "/var/lib/kwizera-ai-studio";
const runDir = process.env.KWIZERA_MT5_HFM_RUN_DIR || "/run/kwizera/mt5-hfm";
// Write as the invoking user (kwizera) into a private staging dir; root helper moves into RUN_DIR.
const stageDir =
  process.env.KWIZERA_MT5_HFM_LOGIN_STAGE_DIR ||
  join(process.env.HOME || "/tmp", ".kwizera-mt5-hfm-login-stage");
const winePrefix = process.env.WINEPREFIX || "/home/mt5/.wine-hfm";
const termRoot = join(winePrefix, "drive_c/Program Files/HFM Metatrader 5");
const expertEx5 = join(termRoot, "MQL5/Experts/KwizeraReadonlySnapshot.ex5");
const secretId = "mt5-hfm:demo:password";
const validateOnly = process.argv.includes("--validate");

function loadDotEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
  }
}

function shred(path) {
  try {
    if (!existsSync(path)) return;
    const fd = openSync(path, "r+");
    try {
      const size = readFileSync(path).length;
      writeSync(fd, Buffer.alloc(size, 0));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    unlinkSync(path);
  } catch {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  }
}

function maskLogin(login) {
  const s = String(login || "");
  if (s.length < 4) return "••••";
  return `••••${s.slice(-4)}`;
}

loadDotEnv();

const secretsMod = await import(pathToFileURL(join(root, "dist/ai/connector-management/secrets-manager.js")).href);
const secrets = new secretsMod.AiSecretsManager();
await secrets.initialize(storageRoot);
if (!secrets.isUnlocked()) {
  console.error("vault_locked");
  process.exit(2);
}
const password = secrets.get(secretId);
if (!password || password.length < 4) {
  console.error("demo_password_missing");
  process.exit(3);
}

const profilePath = join(storageRoot, "mt5-hfm/demo-profile.json");
if (!existsSync(profilePath)) {
  console.error("demo_profile_missing");
  process.exit(4);
}
const profile = JSON.parse(readFileSync(profilePath, "utf8"));
const login = String(profile.login || "").trim();
const server = String(profile.server || "").trim();
if (!/^[A-Za-z0-9._-]{4,32}$/.test(login)) {
  console.error("demo_login_invalid");
  process.exit(5);
}
if (!server || /live/i.test(server)) {
  console.error("demo_server_invalid");
  process.exit(6);
}

const expertOk = existsSync(expertEx5);
let startup = "";
if (expertOk) {
  startup =
    "\n[StartUp]\n" +
    "Expert=KwizeraReadonlySnapshot\n" +
    "Symbol=EURUSD\n" +
    "Period=H1\n";
}

mkdirSync(stageDir, { recursive: true, mode: 0o700 });
chmodSync(stageDir, 0o700);
const basename = `login-${process.pid}-${Math.floor(Date.now() / 1000)}.ini`;
const iniPath = join(stageDir, basename);
const content =
  "[Common]\n" +
  `Login=${login}\n` +
  `Server=${server}\n` +
  `Password=${password}\n` +
  "KeepPrivate=1\n" +
  "ProxyEnable=0\n" +
  startup;

const fd = openSync(iniPath, "wx", 0o600);
try {
  writeSync(fd, content, undefined, "ascii");
  fsyncSync(fd);
} finally {
  closeSync(fd);
}
chmodSync(iniPath, 0o600);

const metaPath = join(stageDir, "startup.env");
writeFileSync(
  metaPath,
  `INI_BASENAME=${basename}\nLOGIN_HINT=${maskLogin(login)}\nSERVER=${server}\nEXPERT=${expertOk ? "1" : "0"}\nSTAGE_DIR=${stageDir}\n`,
  { encoding: "utf8", mode: 0o600 },
);
chmodSync(metaPath, 0o600);

console.log(`INI_BASENAME=${basename}`);
console.log(`LOGIN_HINT=${maskLogin(login)}`);
console.log(`SERVER=${server}`);
console.log(`EXPERT=${expertOk ? "1" : "0"}`);
console.log(`STAGE_DIR=${stageDir}`);
console.log(`VALIDATE=${validateOnly ? "1" : "0"}`);
// Hint for the root helper (never a secret).
console.log(`RUN_DIR=${runDir}`);

if (validateOnly) {
  shred(iniPath);
  console.log("validate_ok ini_shredded=1");
  process.exit(0);
}
