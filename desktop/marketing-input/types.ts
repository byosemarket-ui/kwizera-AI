/** Phase 2 Step 4 — Marketing Input, Campaign Configuration & Production Brief */

import type { ProductProfile, ProductionRunState } from "../product-profile/types";

export type ChangeSource = "user" | "ai-recommendation" | "system";
export type AiRecStatus = "pending" | "accepted" | "rejected" | "edited";
export type DurationPreset = "automatic" | "short" | "medium" | "long" | "custom";

export interface MarketingHistoryEntry {
  id: string;
  at: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  source: ChangeSource;
}

export interface AiRecommendation {
  id?: string;
  field: string;
  label?: string;
  value: string | string[];
  reason: string;
  why?: string;
  source?: "CONFIRMED" | "INFERRED" | "USER_DEFINED";
  reasoningBasis?: string;
  confidence: number;
  status: AiRecStatus;
}

export interface MarketingConflict {
  id: string;
  code: "platform-duration" | "missing-cta" | "promotion-detail" | "voice-language" | "missing-language" | "invalid-config";
  message: string;
  severity: "warning" | "error";
  acknowledged: boolean;
}

export interface MarketingInputFields {
  objective: string;
  audienceType: string;
  ageRange: string;
  gender: string;
  location: string;
  interests: string[];
  customerNeeds: string;
  buyingIntent: string;
  customerSegment: string;
  audienceNotes: string;
  platforms: string[];
  customPlatform: string;
  aspectRatio: string;
  contentFormat: string;
  customFormat: string;
  duration: DurationPreset;
  customDurationSeconds: number | null;
  language: string;
  languageOther: string;
  voiceLanguage: string;
  voiceGender: string;
  voiceStyle: string;
  tone: string;
  narrationEnabled: boolean;
  customVoiceNotes: string;
  cta: string;
  ctaCustom: string;
  promotionType: string;
  promotionDetails: string;
  style: string;
  mood: string;
  energy: string;
  visualPreference: string;
  backgroundPreference: string;
  brandFeeling: string;
  cameraPreference: string;
  musicPreference: string;
  campaignNotes: string;
  brandName: string;
  brandStyle: string;
  brandColors: string;
  brandVoice: string;
  brandGuidelines: string;
  lockedFields: string[];
}

export interface MarketingCompleteness {
  objective: number;
  audience: number;
  platform: number;
  language: number;
  cta: number;
  promotion: number;
  overall: number;
  missingRecommended: string[];
}

export interface FieldValidation {
  field: string;
  status: "ok" | "warning" | "error";
  message: string;
}

export interface StructuredMarketingPlan {
  audience: string;
  angle: string;
  mainSellingPoint: string;
  supportingPoints: string[];
  message: string;
  cta: string;
  platformStrategy: string;
  tone: string;
  videoObjective: string;
  analyzedAt: string;
}

export interface VideoConcept {
  purpose: string;
  presentationStyle: string;
  visualDirection: string;
  storyDirection: string;
  approximateDurationSec: number;
  sceneStrategy: string;
  ctaPlacement: string;
  createdAt: string;
}

export interface ProvenanceClaimView {
  text: string;
  source: "CONFIRMED" | "INFERRED" | "USER_DEFINED";
  confidence: number;
  reason?: string;
}

export interface AuthoritativeBriefView {
  briefId: string;
  productId: string;
  projectId: string;
  briefVersion: number;
  activeVersion: number;
  status: "DRAFT" | "INTELLIGENCE_READY" | "READY_FOR_SCRIPT";
  campaign: {
    objective: string;
    platforms: string[];
    cta: string;
    tone: string;
    lockedFields: string[];
  };
  output: {
    aspectRatio: string;
    duration: string;
    contentFormat: string;
  };
  marketing: {
    positioning: string;
    angle: string;
    mainSellingPoint: ProvenanceClaimView;
    supportingPoints: ProvenanceClaimView[];
    message: string;
    cta: string;
  };
  creative: { tone: string; style: string };
  productAssets: Record<string, string[]>;
  intelligence: {
    category?: ProvenanceClaimView;
    positioning?: ProvenanceClaimView;
    productStrengths?: ProvenanceClaimView[];
    visualStrengths?: ProvenanceClaimView[];
    detailsWorthShowing?: ProvenanceClaimView[];
    mainSellingPoint?: ProvenanceClaimView;
    supportingPoints?: ProvenanceClaimView[];
    marketingAngle?: ProvenanceClaimView;
    suggestedCta?: ProvenanceClaimView;
    audienceHypotheses?: ProvenanceClaimView[];
    platformStrategy?: ProvenanceClaimView;
  } | null;
  versions: Array<{ version: number; createdAt: string; reason: string }>;
  recommendations?: Array<{
    id: string;
    field: string;
    label?: string;
    value: string | string[];
    why?: string;
    reason?: string;
    source?: "CONFIRMED" | "INFERRED" | "USER_DEFINED";
    reasoningBasis?: string;
    confidence: number;
    status: string;
  }>;
}

export interface CanonicalProductSummary {
  productId: string;
  projectId: string;
  identity: { name: string; brand: string; category: string; productType: string };
  assetMap: Record<string, string[]>;
  originalAssetIds: string[];
  visualFeatures: string[];
  sellingPoints: string[];
  readiness: string;
}

export interface MarketingProductionBrief {
  version: 1;
  marketingBriefId: string;
  projectId: string;
  productId: string;
  projectName: string;
  productProfile: ProductProfile;
  fields: MarketingInputFields;
  recommendations: AiRecommendation[];
  conflicts: MarketingConflict[];
  history: MarketingHistoryEntry[];
  completeness: MarketingCompleteness;
  validations: FieldValidation[];
  validationStatus: "incomplete" | "warnings" | "valid";
  canContinue: boolean;
  canStartProduction: boolean;
  continueBlockedReason: string | null;
  productionBlockedReason: string | null;
  continueAnyway: boolean;
  marketingPlan: StructuredMarketingPlan | null;
  videoConcept: VideoConcept | null;
  production: ProductionRunState;
  authoritative: AuthoritativeBriefView | null;
  canonicalProduct: CanonicalProductSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingSnapshot {
  version: 1;
  brief: MarketingProductionBrief | null;
  recommendation: string;
  handoffReady: boolean;
  updatedAt: string;
}

export interface Step5HandoffPayload {
  version: 1;
  step: "step-5-live-product-validation";
  projectId: string;
  projectName: string;
  productProfile: ProductProfile;
  marketingBrief: MarketingProductionBrief;
  preparedAt: string;
}

export const MARKETING_STORE_KEY = "kwizera.marketing-input.v1";
export const MARKETING_HANDOFF_KEY = "kwizera.marketing-input.handoff.v1";

export const OBJECTIVE_PRESETS = [
  "Product Awareness",
  "Sales",
  "Product Launch",
  "Brand Awareness",
  "Promotion",
  "Engagement",
  "Direct Sales",
  "New Arrival",
  "Traffic",
  "Lead Generation",
  "Seasonal Campaign",
  "Custom Objective",
] as const;

export const PLATFORM_PRESETS = [
  "TikTok",
  "Instagram",
  "Facebook",
  "YouTube",
  "WhatsApp",
  "Website",
  "Online Store",
  "Digital Advertisement",
  "Custom Platform",
] as const;

export const FORMAT_PRESETS = [
  "Short Product Video",
  "Social Media Ad",
  "Product Showcase",
  "Product Introduction",
  "Promotional Video",
  "Product Demonstration",
  "Brand Video",
  "Custom Format",
] as const;

export const ASPECT_RATIO_PRESETS = ["9:16", "1:1", "16:9"] as const;

export const CTA_PRESETS = [
  "Buy Now",
  "Order Now",
  "Contact Us",
  "Visit Our Store",
  "Shop Now",
  "Learn More",
  "WhatsApp Us",
  "Custom CTA",
] as const;

export const PROMOTION_PRESETS = [
  "None",
  "Discount",
  "Sale",
  "Limited Offer",
  "New Arrival",
  "Free Delivery",
  "Bundle",
  "Special Price",
  "Seasonal Offer",
  "Custom Promotion",
] as const;

export const TONE_PRESETS = [
  "Professional",
  "Energetic",
  "Premium",
  "Friendly",
  "Emotional",
  "Minimal",
  "Direct Sales",
  "Custom",
] as const;

export const LANGUAGE_PRESETS = ["Kinyarwanda", "English", "Other"] as const;

export function emptyMarketingFields(): MarketingInputFields {
  return {
    objective: "",
    audienceType: "",
    ageRange: "",
    gender: "",
    location: "",
    interests: [],
    customerNeeds: "",
    buyingIntent: "",
    customerSegment: "",
    audienceNotes: "",
    platforms: [],
    customPlatform: "",
    aspectRatio: "",
    contentFormat: "",
    customFormat: "",
    duration: "automatic",
    customDurationSeconds: null,
    language: "Kinyarwanda",
    languageOther: "",
    voiceLanguage: "",
    voiceGender: "",
    voiceStyle: "",
    tone: "Professional",
    narrationEnabled: true,
    customVoiceNotes: "",
    cta: "",
    ctaCustom: "",
    promotionType: "None",
    promotionDetails: "",
    style: "",
    mood: "",
    energy: "",
    visualPreference: "",
    backgroundPreference: "",
    brandFeeling: "",
    cameraPreference: "",
    musicPreference: "",
    campaignNotes: "",
    brandName: "",
    brandStyle: "",
    brandColors: "",
    brandVoice: "",
    brandGuidelines: "",
    lockedFields: [],
  };
}

export function resolvedAudienceSummary(fields: MarketingInputFields): string {
  const parts = [
    fields.audienceType,
    fields.customerSegment,
    fields.ageRange ? `ages ${fields.ageRange}` : "",
    fields.location,
    fields.interests.length ? fields.interests.join(", ") : "",
  ].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return fields.audienceNotes.trim() || "";
}

export function resolvedPlatforms(fields: MarketingInputFields): string[] {
  const list = [...fields.platforms];
  if (fields.platforms.includes("Custom Platform") && fields.customPlatform.trim()) {
    return list.map((p) => (p === "Custom Platform" ? fields.customPlatform.trim() : p));
  }
  return list;
}

export function resolvedCta(fields: MarketingInputFields): string {
  if (fields.cta === "Custom CTA") return fields.ctaCustom.trim();
  return fields.cta.trim();
}

export function resolvedLanguage(fields: MarketingInputFields): string {
  if (fields.language === "Other") return fields.languageOther.trim() || "Other";
  return fields.language;
}

export function resolvedFormat(fields: MarketingInputFields): string {
  if (fields.contentFormat === "Custom Format") return fields.customFormat.trim() || "Custom Format";
  return fields.contentFormat;
}

export function sourceLabel(source?: string): string {
  if (source === "CONFIRMED" || source === "user" || source === "user-provided") return "Product data";
  if (source === "USER_DEFINED") return "Your setting";
  if (source === "INFERRED" || source === "ai" || source === "ai-recommendation") return "AI inference";
  return source ? source.replace(/_/g, " ") : "";
}
