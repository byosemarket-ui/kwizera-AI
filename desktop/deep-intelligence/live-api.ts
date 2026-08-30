/** Live Product Intelligence + Creative Planning APIs (STEP 7). */

export interface ProvenanceStatementDto {
  field: string;
  value: string;
  kind: "user-provided" | "observed-from-image" | "inferred" | "marketing-recommendation";
  confidence: number;
  source?: string;
  assetId?: string;
}

export interface ProductIntelligenceDto {
  id: string;
  projectId: string;
  productId?: string;
  productName: string;
  identifiedAs: string;
  productType: string;
  category: string;
  brand: string;
  description: string;
  imageIds: string[];
  viewCount: number;
  materials: string[];
  colours: string[];
  textures: string[];
  shapes: string[];
  features: string[];
  functions: string[];
  targetAudience: string;
  analysisState?: string;
  analysisVersion?: string;
  analysisError?: string;
  aiInferenceStatus?: string;
  userFacts?: ProvenanceStatementDto[];
  imageObservations?: ProvenanceStatementDto[];
  inferences?: ProvenanceStatementDto[];
  recommendations?: ProvenanceStatementDto[];
  valueProposition?: {
    productSummary: string;
    customerProblem: string;
    customerBenefit: string;
    differentiators: string[];
    positioning: string;
    provenance: string;
  };
  customerIntelligence?: {
    customerType: string;
    useCase: string;
    needs: string[];
    buyingMotivations: string[];
    possibleObjections: string[];
    relevantBenefits: string[];
    label: string;
  };
  marketingDirections?: Array<{ id: string; recommended: boolean; evidence: string[]; confidence: number }>;
  creativeAngles?: Array<{ id: string; name: string; rationale: string; rank: number; evidence: string[] }>;
  quality: { score: number; confidence: number; notes: string[] };
  missingInformation?: Array<{ field: string; severity: string; recommendation: string }>;
  memoryStatus?: string;
  knowledgeStatus?: string;
  knowledgeMessage?: string;
}

export interface MarketingIntelligenceDto {
  id: string;
  projectId: string;
  productId?: string;
  productOverview: string;
  audience: { persona: string; needs: string[]; messaging: string; label?: string };
  valueProposition: string;
  valuePropositionStructured?: ProductIntelligenceDto["valueProposition"];
  directions?: Array<{ id: string; recommended: boolean; evidence: string[]; confidence: number }>;
  strategy: string;
  ctas: string[];
  analysisState?: string;
  score: number;
}

export interface CreativePlanSceneDto {
  id: string;
  order: number;
  durationSeconds: number;
  durationMs?: number;
  startMs?: number;
  beat?: string;
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
  motion?: string;
  view?: string;
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
  selectedFor?: string;
  selectionReason?: string;
  priority?: number;
  fieldSources?: Record<string, "AI_RECOMMENDED" | "USER_DEFINED">;
  userEdited?: boolean;
}

export interface ProductionManifestDto {
  manifestId: string;
  projectId: string;
  productId: string;
  marketingBriefId: string;
  briefVersion: number;
  version: number;
  platform: string;
  format: { aspectRatio: string; width: number; height: number };
  timeline: { durationMs: number; scenes: CreativePlanSceneDto[] };
  script: {
    headline: string;
    hook: string;
    productName: string;
    mainMessage: string;
    supportingPoints: string[];
    featureText: string;
    cta: string;
    narration: string[];
    website?: string;
    priceLine?: string;
  };
  commercial?: {
    productName: string;
    pricing: {
      currentPrice: number | null;
      originalPrice: number | null;
      currency: string;
      discountPercentage: number | null;
    };
    promotion: { enabled: boolean; message: string };
    destination: { website: string; phone?: string; email?: string; socialHandle?: string };
    missing: string[];
  };
  missing: string[];
  status: "DRAFT" | "PARTIALLY_READY" | "READY_FOR_VIDEO_PRODUCTION";
}

export interface CreativePlanDto {
  id: string;
  projectId: string;
  productId?: string;
  version: number;
  createdAt: string;
  modifiedAt: string;
  creativeBrief: string;
  creativeStrategy: string;
  marketingStrategy: string;
  scenes: CreativePlanSceneDto[];
  script?: string;
  objective?: string;
  audience?: string;
  message?: string;
  angle?: string;
  visualDirection?: string;
  audioDirection?: string;
  callToAction?: string;
  userEdited?: boolean;
  marketingBriefId?: string;
  briefVersion?: number;
  manifestId?: string;
  storyBeats?: string[];
  timelineDurationMs?: number;
  aspectRatio?: string;
  platforms?: string[];
  missing?: string[];
  productionStatus?: "DRAFT" | "PARTIALLY_READY" | "READY_FOR_VIDEO_PRODUCTION";
  commercial?: ProductionManifestDto["commercial"];
  productionScript?: ProductionManifestDto["script"];
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${response.status})`);
  return body;
}

export async function getProductIntelligence(projectId: string): Promise<{ profile: ProductIntelligenceDto | null; analysisState: string }> {
  const response = await fetch(`/api/product-intelligence/projects/${projectId}`);
  return readJson(response);
}

export async function analyzeProductIntelligence(projectId: string): Promise<{ profile: ProductIntelligenceDto; analysisState?: string }> {
  const response = await fetch(`/api/product-intelligence/projects/${projectId}/analyze`, { method: "POST" });
  return readJson(response);
}

export async function getMarketingIntelligence(projectId: string): Promise<{ profile: MarketingIntelligenceDto | null }> {
  const response = await fetch(`/api/marketing-intelligence/projects/${projectId}`);
  if (response.status === 404) return { profile: null };
  return readJson(response);
}

export async function analyzeMarketingIntelligence(projectId: string): Promise<{ profile: MarketingIntelligenceDto }> {
  const response = await fetch(`/api/marketing-intelligence/projects/${projectId}/analyze`, { method: "POST" });
  return readJson(response);
}

export async function getCreativePlan(projectId: string): Promise<{ plan: CreativePlanDto | null }> {
  const response = await fetch(`/api/workspace/projects/${projectId}/plan`);
  return readJson(response);
}

export async function generateCreativePlan(projectId: string): Promise<{ plan: CreativePlanDto }> {
  const response = await fetch(`/api/workspace/projects/${projectId}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate" }),
  });
  return readJson(response);
}

export async function updateCreativePlan(projectId: string, changes: Record<string, unknown>): Promise<{ plan: CreativePlanDto }> {
  const response = await fetch(`/api/workspace/projects/${projectId}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes }),
  });
  return readJson(response);
}

export async function getProductionManifest(projectId: string): Promise<{ manifest: ProductionManifestDto | null }> {
  const response = await fetch(`/api/workspace/projects/${projectId}/production-manifest`);
  return readJson(response);
}

export async function finalizeCreativePlan(projectId: string): Promise<{ plan: CreativePlanDto; manifest: ProductionManifestDto }> {
  const response = await fetch(`/api/workspace/projects/${projectId}/plan/finalize`, { method: "POST" });
  return readJson(response);
}

const PROVENANCE_RUN = /(?:\s*\((?:inferred|observed-from-image|user-provided|recommended|marketing-recommendation)\))+/gi;

export function collapseRepeatedProvenance(text: string): string {
  return text
    .replace(PROVENANCE_RUN, (run) => {
      const match = run.match(/\((inferred|observed-from-image|user-provided|recommended|marketing-recommendation)\)/i);
      return match ? ` (${match[1].toLowerCase()})` : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function stripInferredMarker(text: string): string {
  return collapseRepeatedProvenance(text).replace(/\s*\(inferred\)/gi, "").trim();
}
