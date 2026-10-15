/**
 * Phase 45 — Forex risk settings (filesystem JSON + audit). No secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStorageRoot } from "../../../storage/paths/storage-paths.js";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import {
  FOREX_RISK_DEFAULT_SETTINGS,
  FOREX_RISK_SETTINGS_VERSION,
  type ForexRiskSettings,
  type RiskAccountDataSource,
  type RiskBasis,
  type RiskBudgetMode,
  type RiskCalculationMode,
} from "./types.js";

export interface ForexRiskAuditEntry {
  id: string;
  setting: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
  source: "forex-admin";
}

interface SettingsFile {
  version: typeof FOREX_RISK_SETTINGS_VERSION;
  settings: ForexRiskSettings;
  audit: ForexRiskAuditEntry[];
}

const EMPTY: SettingsFile = {
  version: FOREX_RISK_SETTINGS_VERSION,
  settings: { ...FOREX_RISK_DEFAULT_SETTINGS },
  audit: [],
};

const CURRENCY_RE = /^[A-Z]{3}$/;

export function validateForexRiskSettingsPatch(
  patch: Partial<ForexRiskSettings>,
): { ok: true; settings: Partial<ForexRiskSettings> } | { ok: false; message: string } {
  const out: Partial<ForexRiskSettings> = {};

  if (patch.riskBudgetMode != null) {
    if (patch.riskBudgetMode !== "percentage" && patch.riskBudgetMode !== "fixed") {
      return { ok: false, message: "riskBudgetMode must be percentage or fixed." };
    }
    out.riskBudgetMode = patch.riskBudgetMode as RiskBudgetMode;
  }
  if (patch.riskBasis != null) {
    if (patch.riskBasis !== "manual_balance" && patch.riskBasis !== "manual_equity") {
      return { ok: false, message: "riskBasis must be manual_balance or manual_equity." };
    }
    out.riskBasis = patch.riskBasis as RiskBasis;
  }
  if (patch.calculationMode != null) {
    if (patch.calculationMode !== "risk_budget_first" && patch.calculationMode !== "size_first") {
      return { ok: false, message: "calculationMode must be risk_budget_first or size_first." };
    }
    out.calculationMode = patch.calculationMode as RiskCalculationMode;
  }
  if (patch.accountCurrency != null) {
    const ccy = String(patch.accountCurrency).trim().toUpperCase();
    if (ccy !== "" && !CURRENCY_RE.test(ccy)) {
      return { ok: false, message: "accountCurrency must be a 3-letter ISO code or empty." };
    }
    out.accountCurrency = ccy;
  }
  if (patch.riskPercent != null) {
    const n = Number(patch.riskPercent);
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      return { ok: false, message: "riskPercent must be in (0, 100]." };
    }
    out.riskPercent = n;
  }
  if (patch.riskFixedAmount !== undefined) {
    if (patch.riskFixedAmount == null) out.riskFixedAmount = null;
    else {
      const n = Number(patch.riskFixedAmount);
      if (!Number.isFinite(n) || n <= 0) {
        return { ok: false, message: "riskFixedAmount must be a positive number or null." };
      }
      out.riskFixedAmount = n;
    }
  }
  for (const key of ["manualBalance", "manualEquity", "proposedSize"] as const) {
    if (patch[key] !== undefined) {
      if (patch[key] == null) out[key] = null;
      else {
        const n = Number(patch[key]);
        if (!Number.isFinite(n) || n < 0) {
          return { ok: false, message: `${key} must be a non-negative number or null.` };
        }
        out[key] = n;
      }
    }
  }
  if (patch.minRewardRiskRatio != null) {
    const n = Number(patch.minRewardRiskRatio);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, message: "minRewardRiskRatio must be a non-negative number." };
    }
    out.minRewardRiskRatio = n;
  }
  if (patch.conversionMaxAgeMs != null) {
    const n = Number(patch.conversionMaxAgeMs);
    if (!Number.isFinite(n) || n < 1_000 || n > 86_400_000) {
      return { ok: false, message: "conversionMaxAgeMs must be between 1000 and 86400000." };
    }
    out.conversionMaxAgeMs = Math.floor(n);
  }
  if (patch.requireMarginForEligibility != null) {
    out.requireMarginForEligibility = Boolean(patch.requireMarginForEligibility);
  }
  if (patch.accountDataSource != null) {
    if (patch.accountDataSource !== "manual" && patch.accountDataSource !== "forexconnect") {
      return { ok: false, message: "accountDataSource must be manual or forexconnect." };
    }
    out.accountDataSource = patch.accountDataSource as RiskAccountDataSource;
  }
  if (patch.selectedForexConnectAccountId !== undefined) {
    if (patch.selectedForexConnectAccountId == null || patch.selectedForexConnectAccountId === "") {
      out.selectedForexConnectAccountId = null;
    } else {
      const id = String(patch.selectedForexConnectAccountId).trim();
      if (id.length > 64 || !/^[A-Za-z0-9._-]+$/.test(id)) {
        return { ok: false, message: "selectedForexConnectAccountId format is invalid." };
      }
      out.selectedForexConnectAccountId = id;
    }
  }
  return { ok: true, settings: out };
}

function clampSettings(raw: Partial<ForexRiskSettings>): ForexRiskSettings {
  const validated = validateForexRiskSettingsPatch(raw);
  const patch = validated.ok ? validated.settings : {};
  const merged = { ...FOREX_RISK_DEFAULT_SETTINGS, ...raw, ...patch };
  const again = validateForexRiskSettingsPatch(merged);
  if (!again.ok) return { ...FOREX_RISK_DEFAULT_SETTINGS };
  return {
    ...FOREX_RISK_DEFAULT_SETTINGS,
    ...merged,
    accountCurrency: String(merged.accountCurrency ?? "").trim().toUpperCase(),
  };
}

export class ForexRiskSettingsService {
  private readonly dir: string;
  private readonly filePath: string;

  constructor(storageRoot?: string) {
    this.dir = path.join(storageRoot ?? resolveStorageRoot(), "forex-risk");
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
      version: FOREX_RISK_SETTINGS_VERSION,
      settings: clampSettings(value.settings ?? {}),
      audit: Array.isArray(value.audit) ? value.audit.slice(-200) : [],
    };
  }

  async getSettings(): Promise<ForexRiskSettings> {
    await this.ensureReady();
    return this.read().settings;
  }

  async getAudit(): Promise<ForexRiskAuditEntry[]> {
    await this.ensureReady();
    return this.read().audit.slice().reverse();
  }

  async updateSettings(
    patch: Partial<ForexRiskSettings>,
  ): Promise<{ settings: ForexRiskSettings; changed: ForexRiskAuditEntry[] } | { error: string }> {
    await this.ensureReady();
    const validated = validateForexRiskSettingsPatch(patch);
    if (!validated.ok) return { error: validated.message };
    const current = this.read();
    const next = clampSettings({ ...current.settings, ...validated.settings });
    const changed: ForexRiskAuditEntry[] = [];
    for (const key of Object.keys(next) as Array<keyof ForexRiskSettings>) {
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
      version: FOREX_RISK_SETTINGS_VERSION,
      settings: next,
      audit: [...current.audit, ...changed].slice(-200),
    };
    await writeJsonAtomic(this.filePath, file);
    return { settings: next, changed };
  }
}

let singleton: ForexRiskSettingsService | null = null;

export function getForexRiskSettingsService(storageRoot?: string): ForexRiskSettingsService {
  if (storageRoot) return new ForexRiskSettingsService(storageRoot);
  if (!singleton) singleton = new ForexRiskSettingsService();
  return singleton;
}

export function resetForexRiskSettingsServiceForTests(): void {
  singleton = null;
}
