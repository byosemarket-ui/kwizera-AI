import fs from "node:fs";
import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
import { PreRecoveryValidation } from "./types.js";

export class PreRecoveryValidator {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly storageRoot: string,
    private readonly logger: MemoryRecoveryLogger
  ) {}

  async validate(backupId: string): Promise<PreRecoveryValidation> {
    const diagnostics: string[] = [];
    const backup = this.foundation.getMemoryBackupEngine();

    const backupValidation = backup.validateBackup(backupId);
    const backupIntegrity = backupValidation.valid;
    if (!backupIntegrity) diagnostics.push(...backupValidation.diagnostics);

    const storageAvailable = fs.existsSync(this.storageRoot) && fs.statSync(this.storageRoot).isDirectory();
    if (!storageAvailable) diagnostics.push("Storage root unavailable");

    const storageIntegrity = this.foundation.getStorageEngine().runIntegrityCheck();
    const memoryIntegrity = storageIntegrity.verified;

    const relationshipIntegrity = this.foundation.getRelationshipMemoryEngine().validateIntegrity().valid;

    const configPath = path.join(this.storageRoot, "config");
    const configurationIntegrity =
      !fs.existsSync(configPath) || fs.statSync(configPath).isDirectory();

    const dbPath = path.join(this.storageRoot, "database");
    const databaseIntegrity = !fs.existsSync(dbPath) || fs.statSync(dbPath).isDirectory();

    const valid =
      backupIntegrity &&
      storageAvailable &&
      configurationIntegrity &&
      databaseIntegrity;

    this.logger.log(valid ? "info" : "warn", "validation", "Pre-recovery validation complete", {
      valid,
      backupId,
    });

    return {
      valid,
      backupIntegrity,
      databaseIntegrity,
      memoryIntegrity,
      relationshipIntegrity,
      configurationIntegrity,
      storageAvailable,
      diagnostics,
    };
  }
}
