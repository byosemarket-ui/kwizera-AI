import type { CreativeProjectDto } from "../product-intake/api";
import { loadStep4Handoff } from "../product-profile/profile-engine";
import type { ProductProfile, Step4HandoffPayload } from "../product-profile/types";
import { ensureProjectOpen, fetchMarketingIntelligence, persistMarketingProject } from "./api";
import {
  buildLocalRecommendations,
  computeMarketingCompleteness,
  detectConflicts,
  validateMarketingFields,
} from "./validation";
import type {
  AiRecommendation,
  MarketingHistoryEntry,
  MarketingInputFields,
  MarketingProductionBrief,
  MarketingSnapshot,
  Step5HandoffPayload,
} from "./types";
import {
  emptyMarketingFields,
  MARKETING_HANDOFF_KEY,
  MARKETING_STORE_KEY,
  resolvedAudienceSummary,
  resolvedCta,
  resolvedFormat,
  resolvedLanguage,
  resolvedPlatforms,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

type Listener = (snap: MarketingSnapshot) => void;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadStored(): Record<string, MarketingProductionBrief> {
  try {
    return JSON.parse(localStorage.getItem(MARKETING_STORE_KEY) ?? "{}") as Record<string, MarketingProductionBrief>;
  } catch {
    return {};
  }
}

function saveStored(brief: MarketingProductionBrief): void {
  const map = loadStored();
  map[brief.projectId] = brief;
  localStorage.setItem(MARKETING_STORE_KEY, JSON.stringify(map));
}

function enrich(brief: MarketingProductionBrief): MarketingProductionBrief {
  const validations = validateMarketingFields(brief.fields);
  const baseConflicts = detectConflicts(brief.fields).map((c) => {
    const prev = brief.conflicts.find((x) => x.id === c.id);
    return prev ? { ...c, acknowledged: prev.acknowledged } : c;
  });
  const completeness = computeMarketingCompleteness(brief.fields);
  const errors = validations.filter((v) => v.status === "error");
  const warnings = validations.filter((v) => v.status === "warning");
  const blockingConflicts = baseConflicts.filter((c) => c.severity === "error" && !c.acknowledged);
  const canContinue = errors.length === 0 && blockingConflicts.length === 0;
  return {
    ...brief,
    validations,
    conflicts: baseConflicts,
    completeness,
    validationStatus: errors.length ? "incomplete" : (warnings.length || baseConflicts.some((c) => !c.acknowledged)) ? "warnings" : "valid",
    canContinue,
    continueBlockedReason: errors[0]?.message ?? blockingConflicts[0]?.message ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function fieldsFromProject(project: CreativeProjectDto, product: ProductProfile): MarketingInputFields {
  const base = emptyMarketingFields();
  const campaign = project.campaignInformation ?? { name: "", objective: "" };
  const brand = project.brandInformation ?? { name: "" };
  const platforms = Array.isArray(campaign.platforms) && campaign.platforms.length
    ? campaign.platforms.map(String)
    : project.platform ? [String(project.platform)] : [];

  return {
    ...base,
    objective: String(campaign.objective ?? ""),
    audienceNotes: String(project.targetAudience ?? ""),
    audienceType: String(project.targetAudience ?? ""),
    platforms,
    contentFormat: String(campaign.contentFormat ?? ""),
    duration: (campaign.duration as MarketingInputFields["duration"]) || "automatic",
    customDurationSeconds: typeof campaign.customDurationSeconds === "number" ? campaign.customDurationSeconds : null,
    language: mapLanguageIn(String(project.language ?? "rw")),
    cta: String(campaign.callToAction ?? ""),
    promotionType: String(campaign.promotionType ?? "None") || "None",
    promotionDetails: String(campaign.promotionDetails ?? ""),
    tone: String(campaign.tone ?? "Professional"),
    style: String(campaign.style ?? ""),
    mood: String(campaign.mood ?? ""),
    energy: String(campaign.energy ?? ""),
    campaignNotes: String(campaign.notes ?? ""),
    brandName: String(brand.name || product.fields.brand || ""),
    brandVoice: String(brand.voice ?? ""),
    brandGuidelines: String(brand.guidelines ?? ""),
    brandStyle: String(brand.style ?? ""),
    brandColors: String(brand.colors ?? ""),
    voiceLanguage: mapLanguageIn(String(project.language ?? "rw")),
  };
}

function mapLanguageIn(value: string): string {
  const v = value.toLowerCase();
  if (v === "rw" || v.includes("kinyarwanda")) return "Kinyarwanda";
  if (v === "en" || v.includes("english")) return "English";
  if (!v) return "Kinyarwanda";
  return value === "Kinyarwanda" || value === "English" || value === "Other" ? value : "Other";
}

function mapLanguageOut(fields: MarketingInputFields): string {
  const lang = resolvedLanguage(fields);
  if (lang === "Kinyarwanda") return "rw";
  if (lang === "English") return "en";
  return lang.toLowerCase().slice(0, 8) || "en";
}

function mergeIntelRecommendations(
  local: AiRecommendation[],
  intel: Record<string, unknown> | null,
): AiRecommendation[] {
  if (!intel) return local;
  const out = [...local];
  const ctas = Array.isArray(intel.ctas) ? intel.ctas.map(String) : [];
  if (ctas[0] && !out.some((r) => r.field === "cta")) {
    out.push({
      field: "cta",
      value: ctas[0],
      reason: "Marketing intelligence CTA suggestion — review before accepting.",
      confidence: 0.7,
      status: "pending",
    });
  }
  const platform = intel.platform as { name?: string; format?: string; recommendations?: string[] } | undefined;
  if (platform?.name && !out.some((r) => r.field === "platforms")) {
    out.push({
      field: "platforms",
      value: [platform.name],
      reason: "Marketing intelligence platform suggestion.",
      confidence: 0.65,
      status: "pending",
    });
  }
  if (platform?.format && !out.some((r) => r.field === "contentFormat")) {
    out.push({
      field: "contentFormat",
      value: platform.format,
      reason: "Marketing intelligence format suggestion.",
      confidence: 0.62,
      status: "pending",
    });
  }
  const strategy = String(intel.strategy ?? "");
  if (strategy && !out.some((r) => r.field === "style")) {
    out.push({
      field: "style",
      value: strategy.slice(0, 120),
      reason: "Strategy hint from marketing intelligence.",
      confidence: 0.55,
      status: "pending",
    });
  }
  return out;
}

export class MarketingInputEngine {
  private brief: MarketingProductionBrief | null = null;
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private saving = false;
  private handoffReady = false;
  private recommendation = "Complete Step 3 Product Profile, then configure marketing inputs.";

  setNotify(fn: NotifyFn | null): void {
    this.notify = fn;
  }

  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void {
    this.emitEvents = fn;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): MarketingSnapshot {
    return {
      version: 1,
      brief: this.brief,
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const b = this.brief;
    if (!b) {
      return {
        projectId: null,
        explanation: "Marketing Input has no active production brief yet.",
        canContinue: false,
        recommendation: this.recommendation,
      };
    }
    const f = b.fields;
    const explanation = [
      `Product “${b.productProfile.fields.name || b.projectName}” is linked from Step 3.`,
      `Campaign objective: ${f.objective || "not set"}.`,
      `Platform(s): ${resolvedPlatforms(f).join(", ") || "not set"}.`,
      `Language: ${resolvedLanguage(f) || "not set"}.`,
      `CTA: ${resolvedCta(f) || "not yet specified"}.`,
      `Marketing completeness ${b.completeness.overall}%. Validation: ${b.validationStatus}.`,
      b.conflicts.filter((c) => !c.acknowledged).length
        ? `Open conflicts: ${b.conflicts.filter((c) => !c.acknowledged).map((c) => c.message).join(" ")}`
        : "No unacknowledged conflicts.",
      b.recommendations.filter((r) => r.status === "pending").length
        ? `${b.recommendations.filter((r) => r.status === "pending").length} AI recommendation(s) pending — never auto-applied.`
        : "No pending AI recommendations.",
      "AI Me will not invent product prices, discounts, or contact details.",
      this.recommendation,
    ].join(" ");

    return {
      projectId: b.projectId,
      objective: f.objective,
      platforms: resolvedPlatforms(f),
      language: resolvedLanguage(f),
      cta: resolvedCta(f),
      completeness: b.completeness.overall,
      validationStatus: b.validationStatus,
      canContinue: b.canContinue || b.continueAnyway,
      pendingRecommendations: b.recommendations.filter((r) => r.status === "pending").length,
      recommendation: this.recommendation,
      explanation,
    };
  }

  async hydrateFromHandoff(handoff?: Step4HandoffPayload | null): Promise<boolean> {
    const payload = handoff ?? loadStep4Handoff();
    if (!payload || payload.step !== "step-4-marketing-input") {
      const stored = Object.values(loadStored())[0];
      if (stored) {
        this.brief = enrich(stored);
        this.recommendation = "Restored local marketing brief.";
        this.emitEvent("MarketingInputStarted", { projectId: stored.projectId, restored: true });
        this.emitBus("marketing.started", { projectId: stored.projectId, restored: true });
        this.emit();
        return true;
      }
      this.recommendation = "No Step 3 handoff found. Complete Product Information first.";
      this.emit();
      return false;
    }

    if (payload.productProfile.projectId !== payload.projectId) {
      throw new Error("Cross-project data blocked: product profile project mismatch.");
    }

    const stored = loadStored()[payload.projectId];
    let project: CreativeProjectDto;
    try {
      project = await ensureProjectOpen(payload.projectId);
    } catch (error) {
      this.notify?.("error", "Project unavailable", error instanceof Error ? error.message : "Open failed", "errors");
      return false;
    }

    if (project.id !== payload.projectId) {
      throw new Error("Cross-project data blocked: handoff project mismatch.");
    }

    const fields = stored?.fields ?? fieldsFromProject(project, payload.productProfile);
    if (!fields.brandName.trim()) fields.brandName = payload.productProfile.fields.brand;

    let recommendations = stored?.recommendations ?? [];
    if (!recommendations.length) {
      recommendations = buildLocalRecommendations(fields, payload.productProfile.fields.category);
      const intel = await fetchMarketingIntelligence(payload.projectId).catch(() => null);
      recommendations = mergeIntelRecommendations(recommendations, intel);
    }

    this.brief = enrich({
      version: 1,
      marketingBriefId: stored?.marketingBriefId ?? uid("mbrief"),
      projectId: payload.projectId,
      productId: payload.productProfile.productId || payload.projectId,
      projectName: payload.projectName,
      productProfile: payload.productProfile,
      fields,
      recommendations,
      conflicts: stored?.conflicts ?? [],
      history: stored?.history ?? [],
      completeness: { objective: 0, audience: 0, platform: 0, language: 0, cta: 0, promotion: 0, overall: 0, missingRecommended: [] },
      validations: [],
      validationStatus: "incomplete",
      canContinue: false,
      continueBlockedReason: null,
      continueAnyway: stored?.continueAnyway ?? false,
      createdAt: stored?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.recommendation = this.brief.canContinue || this.brief.continueAnyway
      ? "Critical marketing settings valid — review the Production Brief, then continue."
      : this.brief.continueBlockedReason ?? "Configure campaign objective, audience, platform, format, and language.";

    saveStored(this.brief);
    this.emitEvent("MarketingInputStarted", { projectId: this.brief.projectId });
    this.emitBus("marketing.started", { projectId: this.brief.projectId });
    this.emitEvent("MarketingBriefUpdated", { projectId: this.brief.projectId, overall: this.brief.completeness.overall });
    this.emit();
    return true;
  }

  updateField(field: keyof MarketingInputFields, value: unknown, source: MarketingHistoryEntry["source"] = "user"): void {
    if (!this.brief) return;
    const previous = this.brief.fields[field];
    if (JSON.stringify(previous) === JSON.stringify(value)) return;

    if (source === "ai-recommendation") {
      const current = this.brief.fields[field];
      const hasUser = Array.isArray(current)
        ? current.length > 0
        : typeof current === "boolean"
          ? true
          : String(current ?? "").trim().length > 0 && !(field === "tone" && current === "Professional") && !(field === "duration" && current === "automatic") && !(field === "promotionType" && current === "None") && !(field === "language" && current === "Kinyarwanda");
      if (hasUser && field !== "platforms") {
        this.notify?.(
          "warning",
          "User setting kept",
          `“${field}” already has user data. Accept the AI recommendation explicitly to replace it.`,
          "ai-suggestions",
        );
        return;
      }
    }

    this.brief = enrich({
      ...this.brief,
      continueAnyway: false,
      fields: { ...this.brief.fields, [field]: value } as MarketingInputFields,
      history: [
        {
          id: uid("hist"),
          at: new Date().toISOString(),
          field: String(field),
          previousValue: previous,
          newValue: value,
          source,
        },
        ...this.brief.history,
      ].slice(0, 200),
    });

    this.afterFieldChange(String(field), source);
  }

  togglePlatform(platform: string): void {
    if (!this.brief) return;
    const set = new Set(this.brief.fields.platforms);
    if (set.has(platform)) set.delete(platform);
    else set.add(platform);
    this.updateField("platforms", [...set]);
  }

  acknowledgeConflict(id: string): void {
    if (!this.brief) return;
    this.brief = enrich({
      ...this.brief,
      conflicts: this.brief.conflicts.map((c) => (c.id === id ? { ...c, acknowledged: true } : c)),
      continueAnyway: true,
    });
    saveStored(this.brief);
    this.markDirty();
    this.emit();
  }

  acceptRecommendation(field: string): void {
    if (!this.brief) return;
    const rec = this.brief.recommendations.find((r) => r.field === field && r.status === "pending");
    if (!rec) return;

    if (field === "platforms") {
      const list = Array.isArray(rec.value) ? rec.value.map(String) : [String(rec.value)];
      this.updateField("platforms", list, "user");
    } else if (field === "duration") {
      this.updateField("duration", String(rec.value) as MarketingInputFields["duration"], "user");
    } else if (field === "cta") {
      this.updateField("cta", String(rec.value), "user");
    } else if (field === "contentFormat" || field === "tone" || field === "style" || field === "audienceType") {
      this.updateField(field, String(rec.value), "user");
    }

    this.brief = enrich({
      ...this.brief!,
      recommendations: this.brief!.recommendations.map((r) =>
        r.field === field ? { ...r, status: "accepted" as const } : r,
      ),
      history: [
        {
          id: uid("hist"),
          at: new Date().toISOString(),
          field: `ai.${field}`,
          previousValue: "pending",
          newValue: "accepted",
          source: "ai-recommendation",
        },
        ...this.brief!.history,
      ].slice(0, 200),
    });
    saveStored(this.brief);
    this.schedulePersist();
    this.markDirty();
    this.notify?.("success", "Recommendation accepted", `${field} updated from AI recommendation.`, "ai-suggestions");
    this.emit();
  }

  rejectRecommendation(field: string): void {
    if (!this.brief) return;
    this.brief = enrich({
      ...this.brief,
      recommendations: this.brief.recommendations.map((r) =>
        r.field === field ? { ...r, status: "rejected" as const } : r,
      ),
      history: [
        {
          id: uid("hist"),
          at: new Date().toISOString(),
          field: `ai.${field}`,
          previousValue: "pending",
          newValue: "rejected",
          source: "user",
        },
        ...this.brief.history,
      ].slice(0, 200),
    });
    saveStored(this.brief);
    this.schedulePersist();
    this.markDirty();
    this.emit();
  }

  async flushPersist(): Promise<void> {
    if (!this.brief || this.saving) return;
    this.saving = true;
    try {
      const b = this.brief;
      const f = b.fields;
      const platforms = resolvedPlatforms(f);
      await persistMarketingProject(b.projectId, {
        targetAudience: resolvedAudienceSummary(f),
        language: mapLanguageOut(f),
        platform: platforms[0] ?? "",
        brandInformation: {
          name: f.brandName || b.productProfile.fields.brand,
          voice: f.brandVoice || undefined,
          guidelines: f.brandGuidelines || undefined,
          style: f.brandStyle || undefined,
          colors: f.brandColors || undefined,
        },
        campaignInformation: {
          name: f.objective || b.projectName,
          objective: f.objective,
          callToAction: resolvedCta(f) || undefined,
          notes: f.campaignNotes || undefined,
          contentFormat: resolvedFormat(f) || undefined,
          duration: f.duration,
          customDurationSeconds: f.customDurationSeconds ?? undefined,
          platforms,
          promotionType: f.promotionType !== "None" ? f.promotionType : undefined,
          promotionDetails: f.promotionDetails || undefined,
          tone: f.tone || undefined,
          style: f.style || undefined,
          mood: f.mood || undefined,
          energy: f.energy || undefined,
        },
        workspaceSettings: {
          marketingInputBrief: {
            marketingBriefId: b.marketingBriefId,
            fields: f,
            recommendations: b.recommendations,
            conflicts: b.conflicts,
            history: b.history.slice(0, 100),
            completeness: b.completeness,
            validationStatus: b.validationStatus,
            productProfileRef: b.productId,
            version: b.history.length + 1,
          },
        },
      });
      this.emitEvent("MarketingValidationCompleted", {
        projectId: b.projectId,
        validationStatus: b.validationStatus,
        canContinue: b.canContinue || b.continueAnyway,
      });
    } catch (error) {
      this.notify?.("warning", "Auto-save delayed", error instanceof Error ? error.message : "Save failed", "warnings");
    } finally {
      this.saving = false;
    }
  }

  async continueToStep5(): Promise<Step5HandoffPayload> {
    if (!this.brief) throw new Error("No marketing brief");
    if (!(this.brief.canContinue || this.brief.continueAnyway)) {
      throw new Error(this.brief.continueBlockedReason ?? "Marketing brief incomplete");
    }
    // Critical errors still block even with continueAnyway
    const errors = this.brief.validations.filter((v) => v.status === "error");
    if (errors.length) throw new Error(errors[0].message);

    await this.flushPersist();
    const handoff: Step5HandoffPayload = {
      version: 1,
      step: "step-5-live-product-validation",
      projectId: this.brief.projectId,
      projectName: this.brief.projectName,
      productProfile: this.brief.productProfile,
      marketingBrief: this.brief,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(MARKETING_HANDOFF_KEY, JSON.stringify(handoff));
    this.handoffReady = true;
    this.emitEvent("MarketingBriefReady", {
      projectId: handoff.projectId,
      completeness: this.brief.completeness.overall,
    });
    this.emitBus("marketing.completed", {
      projectId: handoff.projectId,
      marketingBriefId: this.brief.marketingBriefId,
      completeness: this.brief.completeness.overall,
    });
    this.emit();
    return handoff;
  }

  private afterFieldChange(field: string, source: MarketingHistoryEntry["source"]): void {
    if (!this.brief) return;
    this.recommendation = this.brief.canContinue || this.brief.continueAnyway
      ? "Critical marketing settings valid — review brief, then continue to Validation."
      : this.brief.continueBlockedReason ?? "Continue configuring marketing inputs.";
    saveStored(this.brief);
    this.schedulePersist();
    this.markDirty();
    this.emitEvent("MarketingFieldUpdated", { field, source, projectId: this.brief.projectId });
    if (field === "objective") this.emitEvent("CampaignObjectiveChanged", { objective: this.brief.fields.objective });
    if (field.startsWith("audience") || field === "interests" || field === "customerNeeds" || field === "buyingIntent" || field === "customerSegment") {
      this.emitEvent("AudienceUpdated", { audience: resolvedAudienceSummary(this.brief.fields) });
    }
    if (field === "platforms" || field === "customPlatform") this.emitEvent("PlatformUpdated", { platforms: resolvedPlatforms(this.brief.fields) });
    if (field === "language" || field === "languageOther") this.emitEvent("LanguageUpdated", { language: resolvedLanguage(this.brief.fields) });
    if (field.startsWith("voice") || field === "tone" || field === "narrationEnabled") this.emitEvent("VoiceUpdated", {});
    if (field === "cta" || field === "ctaCustom") this.emitEvent("CTAUpdated", { cta: resolvedCta(this.brief.fields) });
    if (field === "promotionType" || field === "promotionDetails") this.emitEvent("PromotionUpdated", {});
    this.emitEvent("MarketingBriefUpdated", { projectId: this.brief.projectId, overall: this.brief.completeness.overall });
    this.emit();
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void this.flushPersist();
    }, 700);
  }

  private markDirty(): void {
    void import("../shell/workspace-state/workspace-state-engine").then(({ workspaceStateEngine }) => {
      workspaceStateEngine.autoSave.markDirty();
    });
  }

  private emitEvent(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, ...payload });
    this.emitEvents?.("product.updated", { action, module: "marketing-input", ...payload });
  }

  private emitBus(type: "marketing.started" | "marketing.completed", payload: Record<string, unknown>): void {
    this.emitEvents?.(type, payload);
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

export const marketingInputEngine = new MarketingInputEngine();

export function loadStep5Handoff(): Step5HandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(MARKETING_HANDOFF_KEY) ?? "null") as Step5HandoffPayload | null;
    return raw?.version === 1 ? raw : null;
  } catch {
    return null;
  }
}
