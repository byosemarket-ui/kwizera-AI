/**
 * Phase 24 — Safe Forex AI intelligence settings (filesystem JSON + audit).
 * Does not expose Ollama host, paths, or secrets for browser mutation.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import {
  FOREX_INTELLIGENCE_CONFIG_VERSION,
  FOREX_INTELLIGENCE_DEFAULT_SETTINGS,
  FOREX_INTELLIGENCE_MEMORY_MAX_EXAMPLES,
  FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET,
  type ForexIntelligenceSettings,
} from "./config.js";

export interface ForexIntelligenceAuditEntry {
  id: string;
  setting: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
  source: "forex-admin";
}

interface SettingsFile {
  version: typeof FOREX_INTELLIGENCE_CONFIG_VERSION;
  settings: ForexIntelligenceSettings;
  audit: ForexIntelligenceAuditEntry[];
}

const EMPTY: SettingsFile = {
  version: FOREX_INTELLIGENCE_CONFIG_VERSION,
  settings: { ...FOREX_INTELLIGENCE_DEFAULT_SETTINGS },
  audit: [],
};

function clampSettings(raw: Partial<ForexIntelligenceSettings>): ForexIntelligenceSettings {
  const maxExamples = Number(raw.memoryMaxExamples ?? FOREX_INTELLIGENCE_DEFAULT_SETTINGS.memoryMaxExamples);
  const budget = Number(raw.promptCharBudget ?? FOREX_INTELLIGENCE_DEFAULT_SETTINGS.promptCharBudget);
  return {
    knowledgeRagEnabled: raw.knowledgeRagEnabled !== false,
    memoryRetrievalEnabled: raw.memoryRetrievalEnabled !== false,
    memoryMaxExamples: Math.min(FOREX_INTELLIGENCE_MEMORY_MAX_EXAMPLES, Math.max(0, Math.floor(maxExamples) || 0)),
    compactPromptMode: raw.compactPromptMode !== false,
    promptCharBudget: Math.min(
      FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET,
      Math.max(1600, Math.floor(budget) || FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET),
    ),
  };
}

export class ForexIntelligenceSettingsService {
  private readonly dir: string;
  private readonly filePath: string;

  constructor(storageRoot?: string) {
    this.dir = path.join(storageRoot ?? resolveStorageRoot(), "forex-intelligence");
    this.filePath = path.join(this.dir, "settings.json");
  }

  async ensureReady(): Promise<void> {
    fs.mkdirSync(this.dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      await writeJsonAtomic(this.filePath, EMPTY);
    }
  }

  private read(): SettingsFile {
    const result = readJsonSafeSync<SettingsFile>(this.filePath, EMPTY);
    const value = result.value ?? EMPTY;
    return {
      version: FOREX_INTELLIGENCE_CONFIG_VERSION,
      settings: clampSettings(value.settings ?? {}),
      audit: Array.isArray(value.audit) ? value.audit.slice(-200) : [],
    };
  }

  async getSettings(): Promise<ForexIntelligenceSettings> {
    await this.ensureReady();
    return this.read().settings;
  }

  async getAudit(): Promise<ForexIntelligenceAuditEntry[]> {
    await this.ensureReady();
    return this.read().audit.slice().reverse();
  }

  async updateSettings(
    patch: Partial<ForexIntelligenceSettings>,
  ): Promise<{ settings: ForexIntelligenceSettings; changed: ForexIntelligenceAuditEntry[] }> {
    await this.ensureReady();
    const current = this.read();
    const next = clampSettings({ ...current.settings, ...patch });
    const changed: ForexIntelligenceAuditEntry[] = [];
    for (const key of Object.keys(next) as Array<keyof ForexIntelligenceSettings>) {
      const oldValue = String(current.settings[key]);
      const newValue = String(next[key]);
      if (oldValue !== newValue) {
        changed.push({
          id: randomUUID(),
          setting: key,
          oldValue,
          newValue,
          timestamp: new Date().toISOString(),
          source: "forex-admin",
        });
      }
    }
    const file: SettingsFile = {
      version: FOREX_INTELLIGENCE_CONFIG_VERSION,
      settings: next,
      audit: [...current.audit, ...changed].slice(-200),
    };
    await writeJsonAtomic(this.filePath, file);
    return { settings: next, changed };
  }
}

let singleton: ForexIntelligenceSettingsService | null = null;

export function getForexIntelligenceSettingsService(): ForexIntelligenceSettingsService {
  singleton ??= new ForexIntelligenceSettingsService();
  return singleton;
}

export function createForexIntelligenceSettingsService(storageRoot?: string): ForexIntelligenceSettingsService {
  return new ForexIntelligenceSettingsService(storageRoot);
}
