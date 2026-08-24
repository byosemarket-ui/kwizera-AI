/** Phase 2 Step 3 — Professional Product Information & Product Profile */

import type { ProductImageSet } from "../image-organization/types";

export type AiSuggestionStatus = "pending" | "accepted" | "rejected" | "edited";

export interface AiDerivedField {
  field: string;
  value: string | number | string[];
  confidence: number;
  status: AiSuggestionStatus;
  source: "product-intelligence" | "image-organization" | "system";
}

export interface ProductVariant {
  id: string;
  kind: "color" | "size" | "model" | "package" | "other";
  label: string;
  values: string[];
}

export interface ProfileHistoryEntry {
  id: string;
  at: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  source: "user" | "ai-suggestion" | "system";
}

export interface ProductProfileFields {
  name: string;
  brand: string;
  model: string;
  sku: string;
  barcode: string;
  category: string;
  subcategory: string;
  price: number | null;
  originalPrice: number | null;
  discount: number | null;
  currency: string;
  costPrice: number | null;
  promotionPrice: number | null;
  priceNotes: string;
  shortDescription: string;
  description: string;
  highlights: string[];
  features: string[];
  benefits: string[];
  materials: string[];
  colors: string[];
  sizes: string[];
  dimensions: string;
  weight: string;
  warranty: string;
  stock: string;
  countryOfOrigin: string;
  additionalNotes: string;
  specifications: Record<string, string>;
}

export interface CompletenessBreakdown {
  information: number;
  images: number;
  specifications: number;
  overall: number;
  missingRecommended: string[];
}

export interface FieldValidation {
  field: string;
  status: "ok" | "warning" | "error";
  message: string;
}

export interface ProductProfile {
  version: 1;
  productId: string;
  projectId: string;
  projectName: string;
  fields: ProductProfileFields;
  variants: ProductVariant[];
  aiDerived: AiDerivedField[];
  history: ProfileHistoryEntry[];
  productImageSet: ProductImageSet | null;
  completeness: CompletenessBreakdown;
  validations: FieldValidation[];
  validationStatus: "incomplete" | "warnings" | "valid";
  canContinue: boolean;
  continueBlockedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSnapshot {
  version: 1;
  profile: ProductProfile | null;
  recommendation: string;
  handoffReady: boolean;
  updatedAt: string;
}

export interface Step4HandoffPayload {
  version: 1;
  step: "step-4-marketing-input";
  projectId: string;
  projectName: string;
  productProfile: ProductProfile;
  preparedAt: string;
}

export const PROFILE_STORE_KEY = "kwizera.product-profile.v1";
export const PROFILE_HANDOFF_KEY = "kwizera.product-profile.handoff.v1";

export function emptyFields(): ProductProfileFields {
  return {
    name: "",
    brand: "",
    model: "",
    sku: "",
    barcode: "",
    category: "",
    subcategory: "",
    price: null,
    originalPrice: null,
    discount: null,
    currency: "RWF",
    costPrice: null,
    promotionPrice: null,
    priceNotes: "",
    shortDescription: "",
    description: "",
    highlights: [],
    features: [],
    benefits: [],
    materials: [],
    colors: [],
    sizes: [],
    dimensions: "",
    weight: "",
    warranty: "",
    stock: "",
    countryOfOrigin: "",
    additionalNotes: "",
    specifications: {},
  };
}

export function categorySpecHints(category: string): Array<{ key: string; label: string; placeholder: string }> {
  const c = category.toLowerCase();
  if (/shoe|sneaker|boot|footwear/.test(c)) {
    return [
      { key: "soleMaterial", label: "Sole Material", placeholder: "Rubber" },
      { key: "upperMaterial", label: "Upper Material", placeholder: "Leather / mesh" },
      { key: "gender", label: "Gender", placeholder: "Unisex" },
      { key: "style", label: "Style", placeholder: "Running / casual" },
    ];
  }
  if (/bag|handbag|backpack|tote/.test(c)) {
    return [
      { key: "capacity", label: "Capacity", placeholder: "20 L" },
      { key: "compartments", label: "Compartments", placeholder: "3" },
      { key: "strapType", label: "Strap Type", placeholder: "Adjustable" },
    ];
  }
  if (/phone|laptop|tablet|electronic|camera|headphone/.test(c)) {
    return [
      { key: "ram", label: "RAM", placeholder: "8 GB" },
      { key: "storage", label: "Storage", placeholder: "256 GB" },
      { key: "battery", label: "Battery", placeholder: "5000 mAh" },
      { key: "connectivity", label: "Connectivity", placeholder: "Wi-Fi / BT" },
      { key: "compatibility", label: "Compatibility", placeholder: "Android / iOS" },
    ];
  }
  if (/apparel|shirt|dress|jacket|clothing/.test(c)) {
    return [
      { key: "fabric", label: "Fabric", placeholder: "Cotton" },
      { key: "fit", label: "Fit", placeholder: "Regular" },
      { key: "gender", label: "Gender", placeholder: "Unisex" },
      { key: "care", label: "Care Instructions", placeholder: "Machine wash cold" },
    ];
  }
  return [
    { key: "capacity", label: "Capacity", placeholder: "" },
    { key: "compatibility", label: "Compatibility", placeholder: "" },
    { key: "power", label: "Power", placeholder: "" },
  ];
}
