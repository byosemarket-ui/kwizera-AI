import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  KnowledgeSourceAvailabilityProber,
  KnowledgeSourceHealthRecord,
  KnowledgeSourceHealthReport,
  KnowledgeSourceHealthWarning,
  RegisteredKnowledgeSource,
} from "./types.js";
import { KnowledgeSourceWarningType } from "./types.js";

const CONSECUTIVE_FAILURES_FOR_CRITICAL = 3;

/** Offline-first default: reports approval status only, performs no network access. */
export const offlineAvailabilityProber: KnowledgeSourceAvailabilityProber = async (source) => ({
  available: source.status === "approved",
});

/** Tracks per-source availability, broken links, and version drift using a pluggable, injectable prober. */
export class KnowledgeSourceHealthMonitor {
  private root = "";
  private initialized = false;
  private readonly records = new Map<string, KnowledgeSourceHealthRecord>();

  constructor(private readonly prober: KnowledgeSourceAvailabilityProber = offlineAvailabilityProber) {}

  async initialize(root: string): Promise<void> {
    this.root = root;
    await fs.mkdir(this.root, { recursive: true });
    await this.restore();
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getRecord(sourceId: string): KnowledgeSourceHealthRecord | null {
    const record = this.records.get(sourceId);
    return record ? structuredClone(record) : null;
  }

  async check(source: RegisteredKnowledgeSource): Promise<KnowledgeSourceHealthRecord> {
    this.ensureReady();
    const previous = this.records.get(source.id);
    let probe: Awaited<ReturnType<KnowledgeSourceAvailabilityProber>>;
    try {
      probe = await this.prober(source);
    } catch (error) {
      probe = { available: false, error: error instanceof Error ? error.message : String(error) };
    }

    const issues: string[] = [];
    if (!probe.available) issues.push(probe.error ?? "Source is not reachable.");
    if (previous?.versionSignature && probe.versionSignature && previous.versionSignature !== probe.versionSignature) {
      issues.push("Source version signature changed since the last check.");
    }

    const record: KnowledgeSourceHealthRecord = {
      sourceId: source.id,
      available: probe.available,
      checked: true,
      responseTimeMs: probe.responseTimeMs,
      consecutiveFailures: probe.available ? 0 : (previous?.consecutiveFailures ?? 0) + 1,
      lastCheckedAt: new Date().toISOString(),
      versionSignature: probe.versionSignature ?? previous?.versionSignature,
      issues,
    };
    this.records.set(source.id, record);
    await this.persist();
    return structuredClone(record);
  }

  async checkAll(sources: RegisteredKnowledgeSource[]): Promise<KnowledgeSourceHealthReport> {
    this.ensureReady();
    const records: KnowledgeSourceHealthRecord[] = [];
    const warnings: KnowledgeSourceHealthWarning[] = [];
    for (const source of sources) {
      const record = await this.check(source);
      records.push(record);
      warnings.push(...this.deriveWarnings(source, record));
    }
    return { checkedAt: new Date().toISOString(), records, warnings };
  }

  private deriveWarnings(source: RegisteredKnowledgeSource, record: KnowledgeSourceHealthRecord): KnowledgeSourceHealthWarning[] {
    const warnings: KnowledgeSourceHealthWarning[] = [];
    if (!record.available) {
      const critical = record.consecutiveFailures >= CONSECUTIVE_FAILURES_FOR_CRITICAL;
      warnings.push({
        sourceId: source.id,
        type: critical ? KnowledgeSourceWarningType.BrokenLink : KnowledgeSourceWarningType.Unavailable,
        severity: critical ? "critical" : "warning",
        message: `${source.name} was unreachable during the last health check (${record.consecutiveFailures} consecutive failure(s)).`,
        recommendation: critical
          ? "Suspend this source until it recovers or replace it with an alternative."
          : "Re-verify the source location; it may be a transient outage.",
      });
    }
    if (record.issues.includes("Source version signature changed since the last check.")) {
      warnings.push({
        sourceId: source.id,
        type: KnowledgeSourceWarningType.VersionChanged,
        severity: "warning",
        message: `${source.name} content signature changed since the last check.`,
        recommendation: "Re-run knowledge acquisition to capture the updated content.",
      });
    }
    return warnings;
  }

  private async restore(): Promise<void> {
    try {
      const saved = JSON.parse(await fs.readFile(path.join(this.root, "health.json"), "utf8")) as KnowledgeSourceHealthRecord[];
      for (const record of saved) this.records.set(record.sourceId, record);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async persist(): Promise<void> {
    const target = path.join(this.root, "health.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify([...this.records.values()], null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.initialized) throw new Error("Knowledge Source Health Monitor is not initialized");
  }
}
