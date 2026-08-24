import { updateProjectApi, type CreativeProjectDto } from "../product-intake/api";
import { loadStep3Handoff } from "../image-organization/organization-engine";
import type { ProductImageSet, Step3HandoffPayload } from "../image-organization/types";
import { ensureProjectOpen, fetchProductIntelligence } from "./api";
import { computeCompleteness, textToList, validateProfileFields } from "./validation";
import type {
  AiDerivedField,
  ProductProfile,
  ProductProfileFields,
  ProductVariant,
  ProfileHistoryEntry,
  ProfileSnapshot,
  Step4HandoffPayload,
} from "./types";
import {
  emptyFields,
  PROFILE_HANDOFF_KEY,
  PROFILE_STORE_KEY,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

type Listener = (snap: ProfileSnapshot) => void;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadStoredProfiles(): Record<string, ProductProfile> {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_STORE_KEY) ?? "{}") as Record<string, ProductProfile>;
  } catch {
    return {};
  }
}

function saveStoredProfile(profile: ProductProfile): void {
  const map = loadStoredProfiles();
  map[profile.projectId] = profile;
  localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(map));
}

function fieldsFromProject(project: CreativeProjectDto, categoryHint: string): ProductProfileFields {
  const info = project.productInformation ?? {};
  const base = emptyFields();
  const asList = (value: unknown): string[] =>
    Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === "string" ? textToList(value) : [];
  const asNum = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const asStr = (value: unknown, fallback = ""): string =>
    typeof value === "string" ? value : fallback;

  return {
    ...base,
    name: asStr(info.name, project.name),
    brand: asStr(info.brand),
    model: asStr(info.model),
    sku: asStr(info.sku),
    barcode: asStr(info.barcode),
    category: asStr(info.category) || categoryHint || "",
    subcategory: asStr(info.subcategory),
    price: asNum(info.price),
    originalPrice: asNum(info.originalPrice),
    discount: asNum(info.discount),
    currency: asStr(info.currency, "RWF") || "RWF",
    costPrice: asNum(info.costPrice),
    promotionPrice: asNum(info.promotionPrice),
    priceNotes: asStr(info.priceNotes),
    shortDescription: asStr(info.shortDescription),
    description: asStr(info.description),
    highlights: asList(info.highlights),
    features: asList(info.features),
    benefits: asList(info.benefits),
    materials: asList(info.materials),
    colors: asList(info.colors),
    sizes: asList(info.sizes),
    dimensions: asStr(info.dimensions),
    weight: asStr(info.weight),
    warranty: asStr(info.warranty),
    stock: asStr(info.stock),
    countryOfOrigin: asStr(info.countryOfOrigin),
    additionalNotes: asStr(info.additionalNotes),
    specifications: (info.specifications && typeof info.specifications === "object"
      ? { ...(info.specifications as Record<string, string>) }
      : {}),
  };
}

function variantsFromSettings(settings: Record<string, unknown> | undefined): ProductVariant[] {
  const raw = settings?.productVariants;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const v = entry as Partial<ProductVariant>;
      if (!v || !Array.isArray(v.values)) return null;
      return {
        id: String(v.id ?? uid("var")),
        kind: (v.kind as ProductVariant["kind"]) ?? "other",
        label: String(v.label ?? "Variant"),
        values: v.values.map(String).filter(Boolean),
      } satisfies ProductVariant;
    })
    .filter(Boolean) as ProductVariant[];
}

function historyFromSettings(settings: Record<string, unknown> | undefined): ProfileHistoryEntry[] {
  const raw = settings?.productProfileHistory;
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e === "object") as ProfileHistoryEntry[];
}

function productInfoPayload(fields: ProductProfileFields): Record<string, unknown> {
  return {
    name: fields.name,
    brand: fields.brand,
    model: fields.model,
    sku: fields.sku || undefined,
    barcode: fields.barcode || undefined,
    category: fields.category,
    subcategory: fields.subcategory || undefined,
    price: fields.price ?? undefined,
    originalPrice: fields.originalPrice ?? undefined,
    discount: fields.discount ?? undefined,
    currency: fields.currency,
    costPrice: fields.costPrice ?? undefined,
    promotionPrice: fields.promotionPrice ?? undefined,
    priceNotes: fields.priceNotes || undefined,
    shortDescription: fields.shortDescription || undefined,
    description: fields.description,
    highlights: fields.highlights,
    features: fields.features,
    benefits: fields.benefits,
    materials: fields.materials,
    colors: fields.colors,
    sizes: fields.sizes,
    dimensions: fields.dimensions || undefined,
    weight: fields.weight || undefined,
    warranty: fields.warranty || undefined,
    stock: fields.stock || undefined,
    countryOfOrigin: fields.countryOfOrigin || undefined,
    additionalNotes: fields.additionalNotes || undefined,
    specifications: fields.specifications,
  };
}

function enrichProfile(profile: ProductProfile): ProductProfile {
  const imageCount = profile.productImageSet?.images.length ?? 0;
  const coverage = profile.productImageSet?.coverageScore ?? (imageCount > 0 ? 50 : 0);
  const validations = validateProfileFields(profile.fields, imageCount);
  const completeness = computeCompleteness(profile.fields, coverage, profile.variants);
  const errors = validations.filter((v) => v.status === "error");
  const warnings = validations.filter((v) => v.status === "warning");
  const canContinue = errors.length === 0;
  return {
    ...profile,
    validations,
    completeness,
    validationStatus: errors.length ? "incomplete" : warnings.length ? "warnings" : "valid",
    canContinue,
    continueBlockedReason: errors[0]?.message ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function deriveAiFields(
  intel: Record<string, unknown> | null,
  imageSet: ProductImageSet | null,
  fields: ProductProfileFields,
): AiDerivedField[] {
  const out: AiDerivedField[] = [];
  const push = (
    field: string,
    value: string | number | string[],
    confidence: number,
    source: AiDerivedField["source"],
  ) => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) return;
    out.push({ field, value, confidence, status: "pending", source });
  };

  if (imageSet?.categoryEstimate && !fields.category.trim()) {
    push("category", imageSet.categoryEstimate, 0.72, "image-organization");
  }
  if (!intel) return out;

  const brand = String(intel.brand ?? "");
  const category = String(intel.category ?? "");
  const materials = Array.isArray(intel.materials) ? intel.materials.map(String) : [];
  const colours = Array.isArray(intel.colours)
    ? intel.colours.map(String)
    : Array.isArray(intel.colors)
      ? intel.colors.map(String)
      : [];
  const features = Array.isArray(intel.features) ? intel.features.map(String) : [];
  const logos = Array.isArray(intel.visibleLogos) ? intel.visibleLogos.map(String) : [];

  if (category) push("category", category, 0.78, "product-intelligence");
  if (brand && !/unknown|not determined|requires/i.test(brand)) {
    push("brand", brand, 0.7, "product-intelligence");
  }
  if (colours.length) push("colors", colours, 0.74, "product-intelligence");
  if (materials.length && !materials.some((m) => /verification|requires/i.test(m))) {
    push("materials", materials, 0.65, "product-intelligence");
  }
  if (features.length) push("features", features.slice(0, 8), 0.6, "product-intelligence");
  if (logos.length) push("detectedLogo", logos.join(", "), 0.68, "product-intelligence");

  return out;
}

export class ProductProfileEngine {
  private profile: ProductProfile | null = null;
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private saving = false;
  private handoffReady = false;
  private recommendation = "Complete Step 2 Image Organization, then open Product Information.";

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

  snapshot(): ProfileSnapshot {
    return {
      version: 1,
      profile: this.profile,
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const p = this.profile;
    const explanation = !p
      ? "Product Information workspace has no active product profile yet."
      : [
          `Product profile for “${p.fields.name || p.projectName}” is ${p.completeness.overall}% complete.`,
          `Information ${p.completeness.information}%, images ${p.completeness.images}%, specifications ${p.completeness.specifications}%.`,
          p.completeness.missingRecommended.length
            ? `Missing recommended: ${p.completeness.missingRecommended.join(", ")}.`
            : "No high-priority recommended gaps.",
          `Validation: ${p.validationStatus}.`,
          p.aiDerived.filter((a) => a.status === "pending").length
            ? `${p.aiDerived.filter((a) => a.status === "pending").length} AI suggestion(s) awaiting review.`
            : "No pending AI suggestions.",
          "AI Me will not invent factual product data — user values stay authoritative.",
          this.recommendation,
        ].join(" ");

    return {
      projectId: p?.projectId ?? null,
      productName: p?.fields.name ?? null,
      completeness: p?.completeness.overall ?? 0,
      validationStatus: p?.validationStatus ?? "incomplete",
      canContinue: p?.canContinue ?? false,
      pendingAiSuggestions: p?.aiDerived.filter((a) => a.status === "pending").length ?? 0,
      recommendation: this.recommendation,
      explanation,
    };
  }

  async hydrateFromHandoff(handoff?: Step3HandoffPayload | null): Promise<boolean> {
    const payload = handoff ?? loadStep3Handoff();
    if (!payload || payload.step !== "step-3-product-information") {
      const stored = Object.values(loadStoredProfiles())[0];
      if (stored) {
        this.profile = enrichProfile(stored);
        this.recommendation = "Restored local product profile.";
        this.emitEvent("ProductInformationStarted", { projectId: stored.projectId, restored: true });
        this.emit();
        return true;
      }
      this.recommendation = "No Step 2 handoff found. Complete Image Organization first.";
      this.emit();
      return false;
    }

    const stored = loadStoredProfiles()[payload.projectId];
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

    const fields = stored?.fields ?? fieldsFromProject(project, payload.productImageSet.categoryEstimate);
    if (!fields.category.trim() && payload.productImageSet.categoryEstimate) {
      fields.category = payload.productImageSet.categoryEstimate;
    }
    const variants = stored?.variants ?? variantsFromSettings(project.workspaceSettings);
    const history = stored?.history?.length
      ? stored.history
      : historyFromSettings(project.workspaceSettings);

    let aiDerived = stored?.aiDerived ?? [];
    if (!aiDerived.length) {
      const intel = await fetchProductIntelligence(payload.projectId);
      aiDerived = deriveAiFields(intel, payload.productImageSet, fields);
    }

    this.profile = enrichProfile({
      version: 1,
      productId: payload.projectId,
      projectId: payload.projectId,
      projectName: payload.projectName || project.name,
      fields,
      variants,
      aiDerived,
      history,
      productImageSet: payload.productImageSet,
      completeness: { information: 0, images: 0, specifications: 0, overall: 0, missingRecommended: [] },
      validations: [],
      validationStatus: "incomplete",
      canContinue: false,
      continueBlockedReason: null,
      createdAt: stored?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.recommendation = this.profile.canContinue
      ? "Critical fields valid — review summary, then continue to Marketing."
      : this.profile.continueBlockedReason ?? "Fill critical product fields.";
    saveStoredProfile(this.profile);
    this.emitEvent("ProductInformationStarted", { projectId: this.profile.projectId });
    this.emitEvent("ProductProfileUpdated", { projectId: this.profile.projectId, overall: this.profile.completeness.overall });
    this.emit();
    return true;
  }

  updateField(field: keyof ProductProfileFields, value: unknown, source: ProfileHistoryEntry["source"] = "user"): void {
    if (!this.profile) return;
    const previous = this.profile.fields[field];
    if (JSON.stringify(previous) === JSON.stringify(value)) return;

    // User priority: never silently overwrite with AI
    if (source === "ai-suggestion") {
      const current = this.profile.fields[field];
      const hasUserValue = Array.isArray(current)
        ? current.length > 0
        : typeof current === "number"
          ? current != null
          : String(current ?? "").trim().length > 0;
      if (hasUserValue && field !== "category") {
        this.notify?.(
          "warning",
          "User value kept",
          `“${field}” already has user data. Accept the AI suggestion explicitly to replace it.`,
          "ai-suggestions",
        );
        return;
      }
    }

    this.profile = enrichProfile({
      ...this.profile,
      fields: { ...this.profile.fields, [field]: value } as ProductProfileFields,
      history: [
        {
          id: uid("hist"),
          at: new Date().toISOString(),
          field: String(field),
          previousValue: previous,
          newValue: value,
          source,
        },
        ...this.profile.history,
      ].slice(0, 200),
    });

    this.recommendation = this.profile.canContinue
      ? "Critical fields valid — ready for Product Profile review."
      : this.profile.continueBlockedReason ?? "Continue filling product information.";

    saveStoredProfile(this.profile);
    this.schedulePersist();
    this.markDirty();
    this.emitEvent("ProductFieldUpdated", { field, source, projectId: this.profile.projectId });
    this.emitEvent("ProductInformationUpdated", { projectId: this.profile.projectId });
    this.emitEvent("ProductCompletenessChanged", {
      overall: this.profile.completeness.overall,
      projectId: this.profile.projectId,
    });
    this.emitEvent("ProductProfileUpdated", { projectId: this.profile.projectId });
    this.emit();
  }

  updateSpecification(key: string, value: string): void {
    if (!this.profile) return;
    const next = { ...this.profile.fields.specifications, [key]: value };
    if (!value.trim()) delete next[key];
    this.updateField("specifications", next);
  }

  addVariant(kind: ProductVariant["kind"], label: string, valuesText: string): void {
    if (!this.profile) return;
    const values = textToList(valuesText);
    if (!values.length) return;
    const variant: ProductVariant = { id: uid("var"), kind, label: label || kind, values };
    this.profile = enrichProfile({
      ...this.profile,
      variants: [...this.profile.variants, variant],
      history: [
        {
          id: uid("hist"),
          at: new Date().toISOString(),
          field: `variant.${kind}`,
          previousValue: null,
          newValue: variant,
          source: "user",
        },
        ...this.profile.history,
      ].slice(0, 200),
    });
    saveStoredProfile(this.profile);
    this.schedulePersist();
    this.markDirty();
    this.emitEvent("ProductVariantAdded", { variantId: variant.id, kind });
    this.emit();
  }

  updateVariant(id: string, patch: Partial<Pick<ProductVariant, "label" | "values" | "kind">>): void {
    if (!this.profile) return;
    const previous = this.profile.variants.find((v) => v.id === id);
    if (!previous) return;
    this.profile = enrichProfile({
      ...this.profile,
      variants: this.profile.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      history: [
        {
          id: uid("hist"),
          at: new Date().toISOString(),
          field: `variant.${id}`,
          previousValue: previous,
          newValue: { ...previous, ...patch },
          source: "user",
        },
        ...this.profile.history,
      ].slice(0, 200),
    });
    saveStoredProfile(this.profile);
    this.schedulePersist();
    this.markDirty();
    this.emitEvent("ProductVariantUpdated", { variantId: id });
    this.emit();
  }

  removeVariant(id: string): void {
    if (!this.profile) return;
    this.profile = enrichProfile({
      ...this.profile,
      variants: this.profile.variants.filter((v) => v.id !== id),
    });
    saveStoredProfile(this.profile);
    this.schedulePersist();
    this.markDirty();
    this.emit();
  }

  acceptAiSuggestion(field: string): void {
    if (!this.profile) return;
    const suggestion = this.profile.aiDerived.find((a) => a.field === field && a.status === "pending");
    if (!suggestion) return;

    // Explicit accept is user-authorized — may replace existing values
    if (field === "colors" || field === "materials" || field === "features") {
      const list = Array.isArray(suggestion.value)
        ? suggestion.value.map(String)
        : textToList(String(suggestion.value));
      this.updateField(field, list, "user");
    } else if (field === "category" || field === "brand") {
      this.updateField(field, String(suggestion.value), "user");
    }

    if (!this.profile) return;
    this.profile = enrichProfile({
      ...this.profile,
      aiDerived: this.profile.aiDerived.map((a) =>
        a.field === field ? { ...a, status: "accepted" as const } : a,
      ),
      history: [
        {
          id: uid("hist"),
          at: new Date().toISOString(),
          field: `ai.${field}`,
          previousValue: "pending",
          newValue: "accepted",
          source: "ai-suggestion",
        },
        ...this.profile.history,
      ].slice(0, 200),
    });
    saveStoredProfile(this.profile);
    this.schedulePersist();
    this.markDirty();
    this.notify?.("success", "AI suggestion accepted", `${field} updated from AI suggestion.`, "ai-suggestions");
    this.emit();
  }

  rejectAiSuggestion(field: string): void {
    if (!this.profile) return;
    this.profile = enrichProfile({
      ...this.profile,
      aiDerived: this.profile.aiDerived.map((a) =>
        a.field === field ? { ...a, status: "rejected" as const } : a,
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
        ...this.profile.history,
      ].slice(0, 200),
    });
    saveStoredProfile(this.profile);
    this.schedulePersist();
    this.markDirty();
    this.notify?.("info", "AI suggestion rejected", `${field} kept as user-controlled.`, "ai-suggestions");
    this.emit();
  }

  editAiSuggestion(field: string, edited: string): void {
    if (!this.profile) return;
    this.profile = enrichProfile({
      ...this.profile,
      aiDerived: this.profile.aiDerived.map((a) =>
        a.field === field ? { ...a, value: edited, status: "edited" as const } : a,
      ),
    });
    if (field === "colors" || field === "materials" || field === "features") {
      this.updateField(field, textToList(edited), "user");
    } else if (field === "category" || field === "brand") {
      this.updateField(field, edited, "user");
    }
    this.profile = enrichProfile({
      ...this.profile!,
      aiDerived: this.profile!.aiDerived.map((a) =>
        a.field === field ? { ...a, status: "edited" as const } : a,
      ),
    });
    saveStoredProfile(this.profile);
    this.schedulePersist();
    this.markDirty();
    this.emit();
  }

  async flushPersist(): Promise<void> {
    if (!this.profile || this.saving) return;
    this.saving = true;
    try {
      const p = this.profile;
      await updateProjectApi(p.projectId, {
        name: p.fields.name.trim() || p.projectName,
        productInformation: productInfoPayload(p.fields),
        brandInformation: p.fields.brand ? { name: p.fields.brand } : undefined,
        workspaceSettings: {
          productVariants: p.variants,
          productProfileHistory: p.history.slice(0, 100),
          productProfileMeta: {
            completeness: p.completeness,
            validationStatus: p.validationStatus,
            aiDerived: p.aiDerived,
            productImageSetRef: p.productImageSet?.projectId ?? null,
            version: p.history.length + 1,
          },
        },
      });
      this.emitEvent("ProductInformationValidated", {
        projectId: p.projectId,
        validationStatus: p.validationStatus,
        canContinue: p.canContinue,
      });
    } catch (error) {
      this.notify?.("warning", "Auto-save delayed", error instanceof Error ? error.message : "Save failed", "warnings");
    } finally {
      this.saving = false;
    }
  }

  async continueToStep4(): Promise<Step4HandoffPayload> {
    if (!this.profile?.canContinue) {
      throw new Error(this.profile?.continueBlockedReason ?? "Product profile incomplete");
    }
    await this.flushPersist();
    const handoff: Step4HandoffPayload = {
      version: 1,
      step: "step-4-marketing-input",
      projectId: this.profile.projectId,
      projectName: this.profile.projectName,
      productProfile: this.profile,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(PROFILE_HANDOFF_KEY, JSON.stringify(handoff));
    this.handoffReady = true;
    this.emitEvent("ProductProfileReady", {
      projectId: handoff.projectId,
      completeness: this.profile.completeness.overall,
    });
    this.emit();
    return handoff;
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
    this.emitEvents?.("product.updated", { action, ...payload });
    if (action === "ProductCompletenessChanged" || action === "ProductProfileUpdated") {
      this.emitEvents?.("state.shared", { action, ...payload });
    }
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

export const productProfileEngine = new ProductProfileEngine();

export function loadStep4Handoff(): Step4HandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_HANDOFF_KEY) ?? "null") as Step4HandoffPayload | null;
    return raw?.version === 1 ? raw : null;
  } catch {
    return null;
  }
}
