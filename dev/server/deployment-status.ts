/**
 * Real CI/CD deployment record written by deploy/update-from-github.sh.
 * Lives under KWIZERA_STORAGE_ROOT/deployment/status.json — never under git.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type DeploymentPhase =
  | "local"
  | "github"
  | "deploying"
  | "verifying"
  | "live"
  | "failed"
  | "rolled_back";

export interface DeploymentFailure {
  timestamp: string;
  commit: string | null;
  message: string;
}

export interface DeploymentRecord {
  status: DeploymentPhase;
  requestedCommit: string | null;
  deployedCommit: string | null;
  previousCommit: string | null;
  timestamp: string;
  result: "success" | "failure" | "in-progress" | null;
  message: string;
  lastFailure: DeploymentFailure | null;
  source: "deployment-file" | "git-head" | "local";
}

export const DEPLOYMENT_STATUS_RELATIVE = path.join("deployment", "status.json");

export function deploymentStatusPath(storageRoot: string): string {
  return path.join(storageRoot, DEPLOYMENT_STATUS_RELATIVE);
}

function gitHead(projectRoot: string): string | null {
  try {
    const result = spawnSync("git", ["-C", projectRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      timeout: 4000,
    });
    if (result.status !== 0) return null;
    const sha = (result.stdout ?? "").trim();
    return /^[0-9a-f]{7,40}$/i.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

function readJsonFile(filePath: string): Partial<DeploymentRecord> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<DeploymentRecord>;
  } catch {
    return null;
  }
}

export interface StageVerification {
  ok: boolean;
  onlineExecuted: boolean;
  errorCode: string | null;
  width: number | null;
  height: number | null;
}

/** Public, secret-free post-deploy verification summary (no providers, models, or prompts). */
export function loadImagePrepVerification(storageRoot: string): {
  commit: string | null;
  checkedAt: string | null;
  stages: Record<string, StageVerification>;
} | null {
  try {
    const file = path.join(storageRoot, "deployment", "phase7-verify.json");
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const stages: Record<string, StageVerification> = {};
    const rawStages = (raw.stages ?? {}) as Record<string, Record<string, unknown>>;
    for (const name of ["SEGMENTATION", "EDITING", "ENHANCEMENT"]) {
      const s = rawStages[name];
      if (!s) continue;
      stages[name] = {
        ok: s.ok === true,
        onlineExecuted: s.onlineExecuted === true,
        errorCode: typeof s.errorCode === "string" ? s.errorCode.replace(/[^A-Z_]/g, "").slice(0, 40) : null,
        width: typeof s.width === "number" ? s.width : null,
        height: typeof s.height === "number" ? s.height : null,
      };
    }
    return {
      commit: typeof raw.commit === "string" && /^[0-9a-f]{7,40}$/i.test(raw.commit) ? raw.commit : null,
      checkedAt: typeof raw.checkedAt === "string" ? raw.checkedAt.slice(0, 40) : null,
      stages,
    };
  } catch {
    return null;
  }
}

export function loadDeploymentRecord(
  storageRoot: string,
  projectRoot: string,
  production: boolean,
): DeploymentRecord {
  const stored = readJsonFile(deploymentStatusPath(storageRoot));
  const head = gitHead(projectRoot);
  if (stored?.status) {
    return {
      status: stored.status,
      requestedCommit: stored.requestedCommit ?? head,
      deployedCommit: stored.deployedCommit ?? head,
      previousCommit: stored.previousCommit ?? null,
      timestamp: stored.timestamp ?? new Date().toISOString(),
      result: stored.result ?? null,
      message: stored.message ?? "",
      lastFailure: stored.lastFailure ?? null,
      source: "deployment-file",
    };
  }
  if (!production) {
    return {
      status: "local",
      requestedCommit: head,
      deployedCommit: head,
      previousCommit: null,
      timestamp: new Date().toISOString(),
      result: null,
      message: "No CI/CD deployment record. This process is not a verified production deploy.",
      lastFailure: null,
      source: "local",
    };
  }
  return {
    status: head ? "github" : "failed",
    requestedCommit: head,
    deployedCommit: head,
    previousCommit: null,
    timestamp: new Date().toISOString(),
    result: head ? null : "failure",
    message: head
      ? "Production process is running, but no CI/CD status file exists yet. This is not a verified live deploy."
      : "Production git HEAD could not be read.",
    lastFailure: null,
    source: "git-head",
  };
}

export const DEPLOYMENT_PHASE_LABELS: Record<DeploymentPhase, string> = {
  local: "Local",
  github: "GitHub",
  deploying: "Deploying",
  verifying: "Verifying",
  live: "Live",
  failed: "Failed",
  rolled_back: "Rolled Back",
};

export function isVerifiedLive(record: DeploymentRecord): boolean {
  return record.status === "live" && record.result === "success";
}

export function deploymentPhaseLabel(record: DeploymentRecord): string {
  if (record.status === "live" && !isVerifiedLive(record)) {
    return DEPLOYMENT_PHASE_LABELS.verifying;
  }
  return DEPLOYMENT_PHASE_LABELS[record.status];
}
