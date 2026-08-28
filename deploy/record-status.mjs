#!/usr/bin/env node
/**
 * Writes / reads CI/CD deployment status under KWIZERA_STORAGE_ROOT.
 * Does not touch project files, databases, or knowledge stores.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storageRoot = process.env.KWIZERA_STORAGE_ROOT
  || (process.platform === "win32" ? path.join(root, ".local-deployment-status") : "/var/lib/kwizera-ai-studio");
const statusDir = path.join(storageRoot, "deployment");
const statusFile = path.join(statusDir, "status.json");

const status = process.argv[2];
if (!status) {
  console.error("usage: record-status.mjs <status>");
  process.exit(1);
}

fs.mkdirSync(statusDir, { recursive: true });

let previous = {};
try {
  previous = JSON.parse(fs.readFileSync(statusFile, "utf8"));
} catch {
  previous = {};
}

const result = process.env.KWIZERA_DEPLOY_RESULT || null;
const record = {
  status,
  requestedCommit: process.env.KWIZERA_DEPLOY_SHA || previous.requestedCommit || null,
  deployedCommit: process.env.KWIZERA_DEPLOYED_SHA || null,
  previousCommit: process.env.KWIZERA_PREVIOUS_SHA || previous.previousCommit || null,
  timestamp: new Date().toISOString(),
  result,
  message: process.env.KWIZERA_DEPLOY_MESSAGE || "",
  lastFailure: result === "failure"
    ? {
      timestamp: new Date().toISOString(),
      commit: process.env.KWIZERA_DEPLOY_SHA || null,
      message: process.env.KWIZERA_DEPLOY_MESSAGE || "Deployment failed",
    }
    : (previous.lastFailure ?? null),
};

fs.writeFileSync(statusFile, `${JSON.stringify(record, null, 2)}\n`);
console.log("[KWIZERA] deployment status:", statusFile);
console.log(JSON.stringify({
  requestedCommit: record.requestedCommit,
  deployedCommit: record.deployedCommit,
  timestamp: record.timestamp,
  result: record.result,
  status: record.status,
}));
