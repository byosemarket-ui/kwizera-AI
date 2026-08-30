import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import { isSafeProjectId } from "../creative-workspace/project-asset.js";
import type { CanonicalProductManager } from "../product-record/canonical-product-manager.js";
import type { CanonicalProduct } from "../product-record/types.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type {
  AuthoritativeMarketingBrief,
  BriefRecommendation,
  BriefVersionSnapshot,
  CampaignSettings,
  OutputSettings,
} from "./types.js";
import { MARKETING_BRIEF_VERSION } from "./types.js";
import { generateMarketingIntelligence } from "./intelligence-engine.js";
import {
  applyAcceptedRecommendation,
  emptyCampaign,
  emptyOutput,
  resolveMarketingCopy,
  resolveOutput,
} from "./resolve-brief.js";
import { objectiveCodeFromLabel, suggestedOutputFromPlatforms } from "./platform-presets.js";

type CampaignPatch = Partial<CampaignSettings> & {
  audience?: Partial<CampaignSettings["audience"]>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function productAssetsFromCanonical(product: CanonicalProduct): AuthoritativeMarketingBrief["productAssets"] {
  const map: AuthoritativeMarketingBrief["productAssets"] = { ...product.assetMap };
  const side = [...(product.assetMap.left ?? []), ...(product.assetMap.right ?? [])];
  const details = [
    ...(product.assetMap.detail ?? []),
    ...(product.assetMap["close-up"] ?? []),
    ...(product.assetMap.material_detail ?? []),
  ];
  if (side.length) map.side = side;
  if (details.length) map.details = details;
  return map;
}

function snapshotOf(brief: AuthoritativeMarketingBrief, reason: string): BriefVersionSnapshot {
  return {
    version: brief.briefVersion,
    createdAt: new Date().toISOString(),
    reason,
    campaign: clone(brief.campaign),
    output: clone(brief.output),
    marketing: clone(brief.marketing),
    status: brief.status,
  };
}

function materialSignature(brief: AuthoritativeMarketingBrief): string {
  return JSON.stringify({
    objective: brief.campaign.objective,
    platforms: brief.campaign.platforms,
    aspectRatio: brief.output.aspectRatio,
    contentFormat: brief.output.contentFormat,
    duration: brief.output.duration,
    cta: brief.campaign.cta,
    tone: brief.campaign.tone,
    mainSellingPoint: brief.marketing.mainSellingPoint.text,
    message: brief.marketing.message,
  });
}

function mergeRecommendations(
  existing: BriefRecommendation[],
  incoming: BriefRecommendation[],
): BriefRecommendation[] {
  const settled = new Map(existing.map((item) => [item.field, item]));
  const out: BriefRecommendation[] = existing.filter((item) => item.status !== "PENDING");
  for (const rec of incoming) {
    const prev = settled.get(rec.field);
    if (prev && (prev.status === "ACCEPTED" || prev.status === "REJECTED" || prev.status === "EDITED")) {
      continue;
    }
    const pending = out.find((item) => item.field === rec.field && item.status === "PENDING");
    if (pending) {
      pending.value = rec.value;
      pending.why = rec.why;
      pending.confidence = rec.confidence;
      pending.reasoningBasis = rec.reasoningBasis;
      pending.label = rec.label;
      continue;
    }
    out.push(rec);
  }
  return out;
}

/**
 * Persistent Marketing Production Brief — one authoritative contract for STEP 2.
 * Product and asset IDs come from Canonical Product Intelligence. This manager
 * never duplicates originals or starts video production.
 */
export class MarketingBriefManager {
  private root = "";
  private workspace: CreativeWorkspaceManager | null = null;
  private canonical: CanonicalProductManager | null = null;
  private marketing: MarketingIntelligenceManager | null = null;

  async initialize(
    storageRoot: string,
    dependencies: {
      workspace: CreativeWorkspaceManager;
      canonical: CanonicalProductManager;
      marketing?: MarketingIntelligenceManager | null;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "creative-workspace", "projects");
    this.workspace = dependencies.workspace;
    this.canonical = dependencies.canonical;
    this.marketing = dependencies.marketing ?? null;
    await fs.mkdir(this.root, { recursive: true });
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace && this.canonical);
  }

  attachMarketingIntelligence(marketing: MarketingIntelligenceManager): void {
    this.marketing = marketing;
  }

  async get(projectId: string): Promise<AuthoritativeMarketingBrief | null> {
    this.ensureReady();
    if (!isSafeProjectId(projectId)) return null;
    return this.load(projectId);
  }

  async getOrCreate(projectId: string): Promise<AuthoritativeMarketingBrief> {
    const existing = await this.get(projectId);
    if (existing) return this.refreshAssets(existing);
    return this.createFromCanonical(projectId);
  }

  async analyze(projectId: string): Promise<AuthoritativeMarketingBrief> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const product = await this.canonical!.get(projectId) ?? await this.canonical!.sync(projectId);
    if (!product.originalAssets.length) {
      throw new Error("Canonical product has no original assets. Complete Product Intelligence first.");
    }

    const brief = (await this.load(projectId)) ?? this.blankBrief(product);
    const generated = generateMarketingIntelligence(project, product);
    brief.intelligence = generated.intelligence;
    brief.recommendations = mergeRecommendations(brief.recommendations, generated.recommendations);
    brief.productId = product.productId;
    brief.projectName = product.projectName;
    brief.productAssets = productAssetsFromCanonical(product);
    if (!brief.campaign.objective) {
      brief.campaign.objective = generated.intelligence.suggestedObjective.source === "USER_DEFINED"
        ? generated.intelligence.suggestedObjective.text
        : brief.campaign.objective;
      if (generated.intelligence.suggestedObjective.source === "USER_DEFINED") {
        brief.campaign.objectiveCode = objectiveCodeFromLabel(brief.campaign.objective);
      }
    }
    if (!brief.campaign.audience.general && generated.intelligence.audienceHypotheses[0]?.source === "USER_DEFINED") {
      brief.campaign.audience.general = generated.intelligence.audienceHypotheses[0].text;
    }
    if (!brief.campaign.cta && generated.intelligence.suggestedCta.source === "USER_DEFINED") {
      brief.campaign.cta = generated.intelligence.suggestedCta.text;
    }

    if (this.marketing?.isInitialized()) {
      await this.marketing.analyze(projectId).catch(() => null);
    }

    brief.status = brief.status === "READY_FOR_SCRIPT" ? "READY_FOR_SCRIPT" : "INTELLIGENCE_READY";
    this.recompute(brief);
    brief.updatedAt = new Date().toISOString();
    await this.save(brief);
    return brief;
  }

  async updateSettings(
    projectId: string,
    patch: {
      campaign?: CampaignPatch;
      output?: Partial<OutputSettings>;
      userDefined?: Record<string, unknown>;
      lockFields?: string[];
    },
  ): Promise<AuthoritativeMarketingBrief> {
    const brief = await this.getOrCreate(projectId);
    const wasReady = brief.status === "READY_FOR_SCRIPT";
    const previous = snapshotOf(brief, "User campaign settings changed");
    const before = materialSignature(brief);
    if (patch.campaign) {
      const audience = { ...brief.campaign.audience, ...(patch.campaign.audience ?? {}) };
      brief.campaign = {
        ...brief.campaign,
        ...patch.campaign,
        audience,
        lockedFields: Array.from(new Set([
          ...brief.campaign.lockedFields,
          ...(patch.campaign.lockedFields ?? []),
          ...(patch.lockFields ?? []),
        ])),
      };
      if (patch.campaign.objective != null) {
        brief.campaign.objectiveCode = objectiveCodeFromLabel(brief.campaign.objective);
      }
    }
    if (patch.output) {
      brief.output = { ...brief.output, ...patch.output };
    }
    if (patch.userDefined) {
      brief.userDefined = { ...brief.userDefined, ...patch.userDefined };
    }
    this.recompute(brief);
    this.maybeVersion(brief, before, previous, wasReady);
    brief.updatedAt = new Date().toISOString();
    await this.save(brief);
    return brief;
  }

  async acceptRecommendation(projectId: string, recommendationId: string): Promise<AuthoritativeMarketingBrief> {
    const brief = await this.requireBrief(projectId);
    const rec = brief.recommendations.find((item) => item.id === recommendationId || item.field === recommendationId);
    if (!rec) throw new Error("Recommendation not found");
    if (rec.status === "REJECTED") throw new Error("Rejected recommendations cannot be applied");
    const wasReady = brief.status === "READY_FOR_SCRIPT";
    const previous = snapshotOf(brief, `Accepted recommendation ${rec.field}`);
    const before = materialSignature(brief);
    rec.status = rec.status === "EDITED" ? "EDITED" : "ACCEPTED";
    const applied = applyAcceptedRecommendation(brief.campaign, brief.output, rec);
    brief.campaign = applied.campaign;
    brief.output = applied.output;
    brief.acceptedRecommendationIds = Array.from(new Set([...brief.acceptedRecommendationIds, rec.id]));
    brief.rejectedRecommendationIds = brief.rejectedRecommendationIds.filter((id) => id !== rec.id);
    this.recompute(brief);
    this.maybeVersion(brief, before, previous, wasReady);
    brief.updatedAt = new Date().toISOString();
    await this.save(brief);
    return brief;
  }

  async rejectRecommendation(projectId: string, recommendationId: string): Promise<AuthoritativeMarketingBrief> {
    const brief = await this.requireBrief(projectId);
    const rec = brief.recommendations.find((item) => item.id === recommendationId || item.field === recommendationId);
    if (!rec) throw new Error("Recommendation not found");
    rec.status = "REJECTED";
    brief.rejectedRecommendationIds = Array.from(new Set([...brief.rejectedRecommendationIds, rec.id]));
    brief.acceptedRecommendationIds = brief.acceptedRecommendationIds.filter((id) => id !== rec.id);
    this.recompute(brief);
    brief.updatedAt = new Date().toISOString();
    await this.save(brief);
    return brief;
  }

  async editRecommendation(
    projectId: string,
    recommendationId: string,
    value: string | string[],
  ): Promise<AuthoritativeMarketingBrief> {
    const brief = await this.requireBrief(projectId);
    const rec = brief.recommendations.find((item) => item.id === recommendationId || item.field === recommendationId);
    if (!rec) throw new Error("Recommendation not found");
    rec.editedValue = value;
    rec.status = "EDITED";
    rec.value = value;
    return this.acceptRecommendation(projectId, rec.id);
  }

  async finalize(projectId: string): Promise<AuthoritativeMarketingBrief> {
    const brief = await this.getOrCreate(projectId);
    if (!brief.campaign.objective.trim()) throw new Error("Campaign objective is required");
    if (!brief.campaign.platforms.length) throw new Error("Select at least one platform");
    if (!brief.productId) throw new Error("Canonical product id is missing");
    if (!brief.intelligence) {
      await this.analyze(projectId);
    }
    const current = (await this.load(projectId)) ?? brief;
    if (!current.campaign.objective.trim()) throw new Error("Campaign objective is required");
    if (!current.campaign.platforms.length) throw new Error("Select at least one platform");
    this.recompute(current);
    if (!current.output.aspectRatio) {
      throw new Error("Select an output aspect ratio. Platform and video format are separate settings.");
    }
    if (!current.output.contentFormat) current.output.contentFormat = "SHORT_PRODUCT_VIDEO";
    if (!current.output.duration) {
      current.output.duration = suggestedOutputFromPlatforms(current.campaign.platforms).duration;
    }
    const wasReady = current.status === "READY_FOR_SCRIPT";
    const previous = snapshotOf(current, "Finalized marketing production brief");
    const before = materialSignature(current);
    current.status = "READY_FOR_SCRIPT";
    this.recompute(current);
    this.maybeVersion(current, before, previous, wasReady);
    current.status = "READY_FOR_SCRIPT";
    current.updatedAt = new Date().toISOString();
    await this.save(current);
    return current;
  }

  private recompute(brief: AuthoritativeMarketingBrief): void {
    const activeRecs = brief.recommendations.filter((item) => item.status === "ACCEPTED" || item.status === "EDITED");
    brief.output = resolveOutput(brief.campaign, brief.output, brief.recommendations);
    brief.marketing = resolveMarketingCopy(brief.campaign, activeRecs, brief.intelligence, brief.userDefined);
    brief.creative = {
      tone: brief.campaign.tone || brief.intelligence?.suggestedTone.text || "PROFESSIONAL",
      style: String(brief.userDefined.style ?? brief.output.contentFormat ?? ""),
    };
    brief.activeVersion = brief.briefVersion;
  }

  private maybeVersion(
    brief: AuthoritativeMarketingBrief,
    previousSignature: string,
    previous: BriefVersionSnapshot,
    wasReady: boolean,
  ): void {
    if (materialSignature(brief) === previousSignature) return;
    if (!wasReady && brief.versions.length === 0) return;
    brief.versions = [...brief.versions, previous].slice(-20);
    brief.briefVersion += 1;
    brief.activeVersion = brief.briefVersion;
  }

  private async createFromCanonical(projectId: string): Promise<AuthoritativeMarketingBrief> {
    const product = await this.canonical!.get(projectId) ?? await this.canonical!.sync(projectId);
    const brief = this.blankBrief(product);
    await this.save(brief);
    return brief;
  }

  private blankBrief(product: CanonicalProduct): AuthoritativeMarketingBrief {
    const now = new Date().toISOString();
    return {
      version: MARKETING_BRIEF_VERSION,
      briefId: `brief_${randomUUID()}`,
      productId: product.productId,
      projectId: product.projectId,
      projectName: product.projectName,
      briefVersion: 1,
      activeVersion: 1,
      createdAt: now,
      updatedAt: now,
      status: "DRAFT",
      campaign: emptyCampaign(),
      output: emptyOutput(),
      marketing: {
        positioning: "",
        angle: "",
        mainSellingPoint: { text: "", source: "INFERRED", confidence: 0 },
        supportingPoints: [],
        message: "",
        cta: "",
      },
      creative: { tone: "", style: "" },
      productAssets: productAssetsFromCanonical(product),
      intelligence: null,
      recommendations: [],
      acceptedRecommendationIds: [],
      rejectedRecommendationIds: [],
      versions: [],
      userDefined: {},
    };
  }

  private async refreshAssets(brief: AuthoritativeMarketingBrief): Promise<AuthoritativeMarketingBrief> {
    const product = await this.canonical!.get(brief.projectId);
    if (!product) return brief;
    brief.productId = product.productId;
    brief.productAssets = productAssetsFromCanonical(product);
    brief.projectName = product.projectName;
    return brief;
  }

  private async requireBrief(projectId: string): Promise<AuthoritativeMarketingBrief> {
    const brief = await this.get(projectId);
    if (!brief) throw new Error("Marketing production brief not found");
    return brief;
  }

  private briefPath(projectId: string): string {
    return path.join(this.root, projectId, "marketing-brief.json");
  }

  private async load(projectId: string): Promise<AuthoritativeMarketingBrief | null> {
    try {
      const raw = JSON.parse(await fs.readFile(this.briefPath(projectId), "utf8")) as AuthoritativeMarketingBrief;
      return raw?.version === 1 ? raw : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private async save(brief: AuthoritativeMarketingBrief): Promise<void> {
    const target = this.briefPath(brief.projectId);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${Date.now()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.root || !this.workspace || !this.canonical) {
      throw new Error("Marketing Brief Manager is not initialized");
    }
  }
}

export { durationLabel };
