import fs from "node:fs";
import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
import { PostRecoveryIntegrity } from "./types.js";

export class PostRecoveryIntegrityChecker {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly storageRoot: string,
    private readonly logger: MemoryRecoveryLogger
  ) {}

  async verify(): Promise<PostRecoveryIntegrity> {
    const diagnostics: string[] = [];

    const storageIntegrity = this.foundation.getStorageEngine().runIntegrityCheck();
    const memoryConsistency = storageIntegrity.verified;
    if (!memoryConsistency) diagnostics.push(...storageIntegrity.issues);

    const relationshipConsistency =
      this.foundation.getRelationshipMemoryEngine().validateIntegrity().valid;
    if (!relationshipConsistency) diagnostics.push("Relationship integrity issues");

    const indexReport = this.foundation.getIndexEngine().buildStatusReport();
    const indexIntegrity = indexReport.readinessScore >= 75;
    if (!indexIntegrity) diagnostics.push("Index integrity below threshold");

    const projectDir = path.join(this.storageRoot, "memory", "projects");
    const projectIntegrity = !fs.existsSync(projectDir) || fs.statSync(projectDir).isDirectory();

    const learningDir = path.join(this.storageRoot, "memory", "learning");
    const learningIntegrity = !fs.existsSync(learningDir) || fs.statSync(learningDir).isDirectory();

    const dbPath = path.join(this.storageRoot, "database");
    const databaseIntegrity = !fs.existsSync(dbPath) || fs.statSync(dbPath).isDirectory();

    const configPath = path.join(this.storageRoot, "config");
    const configurationIntegrity =
      !fs.existsSync(configPath) || fs.statSync(configPath).isDirectory();

    const valid =
      memoryConsistency &&
      relationshipConsistency &&
      indexIntegrity &&
      projectIntegrity &&
      learningIntegrity &&
      databaseIntegrity &&
      configurationIntegrity;

    this.logger.log(valid ? "info" : "warn", "integrity", "Post-recovery integrity check", {
      valid,
      diagnostics,
    });

    return {
      valid,
      memoryConsistency,
      relationshipConsistency,
      indexIntegrity,
      projectIntegrity,
      learningIntegrity,
      databaseIntegrity,
      configurationIntegrity,
      diagnostics,
    };
  }
}
