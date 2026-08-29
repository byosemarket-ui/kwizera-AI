import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativeProject, ValidationResult } from "../creative-workspace/creative-workspace-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { DecisionIntelligenceManager } from "../decision-intelligence/decision-intelligence-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import { ProjectState } from "../state-manager/types.js";
import { planProductScenes } from "./scene-planner.js";
import { appendProvenanceOnce, collapseRepeatedProvenanceMarkers } from "../product-intelligence/provenance-text.js";

export interface PlanScene {
  id: string;
  order: number;
  durationSeconds: number;
  purpose: string;
  visual: string;
  narration: string;
  camera: string;
  lighting: string;
  composition: string;
  animation: string;
  assetId?: string;
  imageRole?: string;
  visualPurpose?: string;
  cameraDirection?: string;
  transition?: string;
  text?: string;
  copy?: {
    headline?: string;
    featureText?: string;
    benefitText?: string;
    supportingText?: string;
    priceOffer?: string;
    callToAction?: string;
  };
  userEdited?: boolean;
}

export interface CreativePlan {
  id: string;
  projectId: string;
  productId?: string;
  createdAt: string;
  modifiedAt: string;
  version: number;
  analyses: {
    product: string;
    brand: string;
    campaign: string;
    audience: string;
    platform: string;
    language: string;
  };
  creativeBrief: string;
  marketingStrategy: string;
  creativeStrategy: string;
  storyboard: string;
  script: string;
  scenes: PlanScene[];
  cameraPlan: string;
  lightingPlan: string;
  colourStyle: string;
  compositionGuide: string;
  animationPlan: string;
  prompts: { image: string; video: string; audio: string };
  workflow: string[];
  objective?: string;
  audience?: string;
  message?: string;
  angle?: string;
  visualDirection?: string;
  audioDirection?: string;
  callToAction?: string;
  productStateHash?: string;
  userEdited?: boolean;
}

export interface PlanResult {
  plan?: CreativePlan;
  validation: ValidationResult;
}

/**
 * Step 2 planning only: it creates editable production direction, never media,
 * rendering, encoding, export, or calls to generation foundations.
 */
export class CreativePlanningManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private marketingIntelligence: MarketingIntelligenceManager | null = null;
  private decisionIntelligence: DecisionIntelligenceManager | null = null;
  private products: ProductIntelligenceManager | null = null;
  private images: ImageIntelligenceManager | null = null;

  async initialize(storageRoot: string, core?: AiCoreManager): Promise<void> {
    this.root = path.join(storageRoot, "creative-planning", "plans");
    this.core = core ?? null;
    await fs.mkdir(this.root, { recursive: true });
  }

  async getPlan(projectId: string): Promise<CreativePlan | null> {
    this.ensureInitialized();
    return this.readJson<CreativePlan | null>(this.planPath(projectId), null);
  }
  attachMarketingIntelligence(manager: MarketingIntelligenceManager): void { this.marketingIntelligence = manager; }
  attachDecisionIntelligence(manager: DecisionIntelligenceManager): void { this.decisionIntelligence = manager; }
  attachProductIntelligence(manager: ProductIntelligenceManager): void { this.products = manager; }
  attachImageIntelligence(manager: ImageIntelligenceManager): void { this.images = manager; }

  validateForPlan(project: CreativeProject): ValidationResult {
    const errors = [
      !project.productInformation.name.trim() ? "Product name is required before creative planning." : "",
      !project.productImages.filter(isOriginalProductImage).length ? "At least one original product image is required." : "",
    ].filter(Boolean);
    return { valid: errors.length === 0, errors };
  }

  async createPlan(project: CreativeProject, validation: ValidationResult): Promise<PlanResult> {
    this.ensureInitialized();
    if (!validation.valid) return { validation };

    const existing = await this.getPlan(project.id);
    const now = new Date().toISOString();
    try {
      await this.decisionIntelligence?.decide(project.id, "pipeline");
    } catch {
      // STEP 7 planning can proceed from product + images without a full campaign decision.
    }
    const product = this.products
      ? (await this.products.getProfile(project.id)) ?? await this.products.analyze(project.id).catch(() => null)
      : null;
    const images = this.images ? await this.images.getProfiles(project.id) : [];
    let marketing: { valueProposition: string; strategy: string; ctas: string[]; platform: { recommendations: string[] } } | undefined;
    try {
      marketing = await this.marketingIntelligence?.analyze(project.id);
    } catch {
      marketing = await this.marketingIntelligence?.getProfile(project.id) ?? undefined;
    }
    const plan = this.buildPlan(project, existing, now, marketing, product, images);
    this.transition(project.id, ProjectState.Modified);
    this.transition(project.id, ProjectState.Saving);
    await this.writeJson(this.planPath(project.id), plan);
    this.transition(project.id, ProjectState.Saved);
    return { plan, validation };
  }

  async updatePlan(projectId: string, changes: Partial<Omit<CreativePlan, "id" | "projectId" | "createdAt" | "modifiedAt" | "version">>): Promise<CreativePlan> {
    const current = await this.getPlan(projectId);
    if (!current) throw new Error("Generate a creative plan before editing it");
    const scenes = Array.isArray(changes.scenes)
      ? changes.scenes.map((scene, index) => ({
        ...scene,
        order: scene.order ?? index + 1,
        userEdited: true,
      }))
      : current.scenes;
    const plan: CreativePlan = {
      ...current,
      ...changes,
      analyses: { ...current.analyses, ...changes.analyses },
      prompts: { ...current.prompts, ...changes.prompts },
      scenes,
      userEdited: true,
      modifiedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    this.transition(projectId, ProjectState.Modified);
    this.transition(projectId, ProjectState.Saving);
    await this.writeJson(this.planPath(projectId), plan);
    this.transition(projectId, ProjectState.Saved);
    return plan;
  }

  getIntegrationStatus(): Record<string, boolean> {
    return {
      aiCore: this.core !== null,
      memoryFoundation: Boolean(this.core?.memoryFoundation),
      knowledgeFoundation: Boolean(this.core?.knowledgeFoundation),
      productIntelligence: Boolean(this.core?.productIntelligenceFoundation),
      imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation),
      marketingIntelligenceRuntime: Boolean(this.marketingIntelligence?.isInitialized()),
      productIntelligenceRuntime: Boolean(this.products?.isInitialized()),
      imageIntelligenceRuntime: Boolean(this.images?.isInitialized()),
      decisionIntelligenceRuntime: Boolean(this.decisionIntelligence?.isInitialized()),
      videoIntelligence: Boolean(this.core?.videoIntelligenceFoundation),
      stateManager: Boolean(this.core?.stateManager),
    };
  }

  private buildPlan(
    project: CreativeProject,
    existing: CreativePlan | null,
    now: string,
    marketing?: { valueProposition: string; strategy: string; ctas: string[]; platform: { recommendations: string[] } },
    product?: Awaited<ReturnType<ProductIntelligenceManager["analyze"]>> | null,
    images: Awaited<ReturnType<ImageIntelligenceManager["getProfiles"]>> = [],
  ): CreativePlan {
    const productInfo = project.productInformation;
    const brand = project.brandInformation;
    const campaign = project.campaignInformation;
    const platform = platformGuidance(project.platform);
    const angle = product?.creativeAngles?.[0];
    const audienceRaw = product?.customerIntelligence?.customerType || project.targetAudience || "audience requires confirmation";
    const audience = product?.customerIntelligence?.label === "inferred"
      ? appendProvenanceOnce(audienceRaw, "inferred")
      : collapseRepeatedProvenanceMarkers(audienceRaw);
    const message = product?.valueProposition?.customerBenefit || productInfo.description || productInfo.name;
    const visualDirection = product?.imageObservations?.find((item) => item.field === "lighting")?.value
      || "Keep lighting and colour consistent with the source product photographs.";
    const scenes = planProductScenes(project, product, images, existing?.scenes ?? []);
    const cta = campaign.callToAction || marketing?.ctas[0] || `Discover ${productInfo.name}`;
    return {
      id: existing?.id ?? randomUUID(),
      projectId: project.id,
      productId: product?.productId || project.id,
      createdAt: existing?.createdAt ?? now,
      modifiedAt: now,
      version: (existing?.version ?? 0) + 1,
      analyses: {
        product: product?.valueProposition?.productSummary || `${productInfo.name} is a ${productInfo.category || product?.category || "product"}: ${productInfo.description}`,
        brand: `${brand.name || "brand requires confirmation"}${brand.voice ? ` communicates with a ${brand.voice} voice` : ""}.`,
        campaign: `${campaign.name || "campaign"} is focused on ${campaign.objective || "introducing the product"}.`,
        audience: `Primary audience: ${audience}.`,
        platform: platform.analysis,
        language: `Use ${languageName(project.language)} for all on-screen and spoken planning copy.`,
      },
      creativeBrief: `Create a ${platform.tone} ${platform.format} for ${brand.name || productInfo.name} that introduces ${productInfo.name}${product?.valueProposition?.positioning ? `. ${product.valueProposition.positioning}` : ""}${marketing ? ` Marketing value: ${marketing.valueProposition}` : ""}`,
      marketingStrategy: marketing?.strategy ?? `Lead with the product, demonstrate a recorded benefit, then close with ${cta}.`,
      creativeStrategy: `${platform.pacing} Angle: ${angle?.name || "product hero"}. Keep ${productInfo.name} the visual priority. Tone stays consistent with ${brand.voice || "clear and confident"} direction.`,
      storyboard: scenes.map((item) => `Scene ${item.order}: ${item.purpose} - ${item.visual} (asset ${item.assetId ?? "unassigned"})`).join("\n"),
      script: scenes.map((item) => `${item.order}. ${item.narration}`).join("\n"),
      scenes,
      cameraPlan: scenes.map((item) => `Scene ${item.order}: ${item.cameraDirection || item.camera}`).join("\n"),
      lightingPlan: scenes.map((item) => `Scene ${item.order}: ${item.lighting}`).join("\n"),
      colourStyle: brand.guidelines || product?.imageObservations?.find((item) => item.field === "visible-color")?.value || "Use a balanced neutral base with one accent aligned to the product colour.",
      compositionGuide: scenes.map((item) => `Scene ${item.order}: ${item.composition}`).join("\n"),
      animationPlan: scenes.map((item) => `Scene ${item.order}: ${item.animation}`).join("\n"),
      prompts: {
        image: `${productInfo.name}, ${productInfo.category}, ${productInfo.description}, ${brand.name || ""} brand direction, ${platform.format}, product hero composition, ${audience}, ${languageName(project.language)} campaign context${marketing ? `, ${marketing.valueProposition}` : ""}`,
        video: `${platform.format}; ${scenes.map((item) => item.visual).join(" Then ")}; ${platform.pacing.toLowerCase()}; end with ${cta}. This is a production plan, not a generated video.`,
        audio: `${languageName(project.language)} voice direction: ${brand.voice || "clear and confident"}. Pace: ${platform.pacing.toLowerCase()}. Script: ${scenes.map((item) => item.narration).join(" ")}`,
      },
      workflow: ["Confirm approved creative brief", "Prepare product image references", "Review storyboard and script", "Review camera, lighting, composition, colour, and animation plans", "Approve prompts for the later production pipeline"],
      objective: campaign.objective || "Introduce the product clearly",
      audience,
      message,
      angle: angle?.name || "product hero",
      visualDirection,
      audioDirection: `${languageName(project.language)}, ${brand.voice || "clear and confident"}`,
      callToAction: cta,
      productStateHash: createHash("sha256").update(JSON.stringify({
        product: project.productInformation,
        images: project.productImages.map((image) => [image.id, image.checksumSha256 ?? image.sizeBytes]),
        planVersion: existing?.version ?? 0,
      })).digest("hex"),
      userEdited: existing?.userEdited ?? false,
    };
  }

  private transition(projectId: string, state: ProjectState): void {
    this.core?.stateManager?.updateProjectState(projectId, state, { systemAction: "creative-planning", metadata: { source: "creative-planning" } });
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try { return JSON.parse(await fs.readFile(filePath, "utf8")) as T; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw new Error(`Unable to read creative plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    const temporary = `${filePath}.${createHash("sha1").update(randomUUID()).digest("hex")}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporary, filePath);
  }

  private ensureInitialized(): void { if (!this.root) throw new Error("Creative Planning Manager is not initialized"); }
  private planPath(projectId: string): string { return path.join(this.root, `${projectId}.json`); }
}

function languageName(language: string): string {
  return ({ en: "English", fr: "French", sw: "Swahili", rw: "Kinyarwanda" } as Record<string, string>)[language] ?? language;
}

function platformGuidance(platform: string): { format: string; tone: string; pacing: string; analysis: string } {
  const guidance: Record<string, { format: string; tone: string; pacing: string; analysis: string }> = {
    instagram: { format: "vertical social video", tone: "polished and human", pacing: "Use a fast first three seconds and concise benefit-led beats.", analysis: "Instagram prioritizes immediate visual impact, concise storytelling, and a clear saved/shared value proposition." },
    tiktok: { format: "vertical short-form video", tone: "direct and native", pacing: "Use a native-feeling hook and fast, honest demonstration.", analysis: "TikTok rewards fast hooks, authentic demonstrations, and direct conversational pacing." },
    facebook: { format: "social video", tone: "clear and trust-building", pacing: "Use clear benefits with readable messaging and a strong closing CTA.", analysis: "Facebook supports benefit-led storytelling that earns attention before the action request." },
    linkedin: { format: "professional social video", tone: "credible and considered", pacing: "Use a concise business-relevant hook and evidence-led value.", analysis: "LinkedIn responds to credible insight, professional presentation, and a clear strategic outcome." },
    youtube: { format: "video content", tone: "informative and engaging", pacing: "Open with value, then progress through a clear narrative arc.", analysis: "YouTube benefits from clear narrative structure, sustained value, and a memorable closing." },
  };
  return guidance[platform] ?? guidance.instagram;
}