import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deploymentPhaseLabel,
  deploymentStatusPath,
  isVerifiedLive,
  loadDeploymentRecord,
} from "../../../../dev/server/deployment-status.js";

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-deploy-status-"));
  temps.push(dir);
  return dir;
}

describe("deployment status source of truth", () => {
  it("treats missing records in non-production as Local, never Live", () => {
    const storage = tempRoot();
    const record = loadDeploymentRecord(storage, process.cwd(), false);
    expect(record.status).toBe("local");
    expect(record.source).toBe("local");
    expect(isVerifiedLive(record)).toBe(false);
    expect(deploymentPhaseLabel(record)).toBe("Local");
  });

  it("does not treat a production git HEAD as Live without a CI/CD success file", () => {
    const storage = tempRoot();
    const record = loadDeploymentRecord(storage, process.cwd(), true);
    expect(record.status).not.toBe("live");
    expect(isVerifiedLive(record)).toBe(false);
  });

  it("reports Live only when the deploy record is live, success, and matches git HEAD", () => {
    const storage = tempRoot();
    const head = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).stdout.trim();
    expect(head).toMatch(/^[0-9a-f]{7,40}$/i);
    fs.mkdirSync(path.dirname(deploymentStatusPath(storage)), { recursive: true });
    fs.writeFileSync(deploymentStatusPath(storage), JSON.stringify({
      status: "live",
      requestedCommit: head,
      deployedCommit: head,
      previousCommit: "def5678",
      timestamp: "2026-08-28T22:00:00.000Z",
      result: "success",
      message: "Production deploy verified",
      lastFailure: null,
    }));
    const record = loadDeploymentRecord(storage, process.cwd(), true);
    expect(record.source).toBe("deployment-file");
    expect(record.commitMismatch).toBe(false);
    expect(record.runtimeGitHead).toBe(head);
    expect(isVerifiedLive(record)).toBe(true);
    expect(deploymentPhaseLabel(record)).toBe("Live");
  });

  it("flags commitMismatch and denies verifiedLive when deployment SHA drifts from git HEAD", () => {
    const storage = tempRoot();
    fs.mkdirSync(path.dirname(deploymentStatusPath(storage)), { recursive: true });
    fs.writeFileSync(deploymentStatusPath(storage), JSON.stringify({
      status: "live",
      requestedCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      deployedCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      previousCommit: null,
      timestamp: "2026-08-28T22:00:00.000Z",
      result: "success",
      message: "Production deploy verified",
      lastFailure: null,
    }));
    const record = loadDeploymentRecord(storage, process.cwd(), true);
    expect(record.commitMismatch).toBe(true);
    expect(record.message).toMatch(/differs from deployment record/i);
    expect(isVerifiedLive(record)).toBe(false);
  });

  it("does not label a live-without-success record as Live", () => {
    const storage = tempRoot();
    fs.mkdirSync(path.dirname(deploymentStatusPath(storage)), { recursive: true });
    fs.writeFileSync(deploymentStatusPath(storage), JSON.stringify({
      status: "live",
      requestedCommit: "abc1234",
      deployedCommit: "abc1234",
      timestamp: "2026-08-28T22:00:00.000Z",
      result: "in-progress",
      message: "not done",
    }));
    const record = loadDeploymentRecord(storage, process.cwd(), true);
    expect(isVerifiedLive(record)).toBe(false);
    expect(deploymentPhaseLabel(record)).toBe("Verifying");
  });
});
