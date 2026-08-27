import type { FieldValidation, ProductProfileFields, ProductReadiness, ProductReadinessState } from "./types.js";

export type { ProductReadiness, ProductReadinessState } from "./types.js";

interface ReadinessFieldRow {
  field: string;
  label: string;
  satisfied: boolean;
  status: "ok" | "missing" | "error";
}

const REQUIRED_FIELDS: Array<{ key: keyof ProductProfileFields | "images"; label: string }> = [
  { key: "name", label: "Product Name" },
  { key: "price", label: "Price" },
  { key: "images", label: "Images" },
];

const OPTIONAL_FIELDS: Array<{ key: keyof ProductProfileFields; label: string }> = [
  { key: "brand", label: "Brand" },
  { key: "model", label: "Model" },
  { key: "sku", label: "SKU" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "materials", label: "Materials" },
  { key: "colors", label: "Colors" },
  { key: "weight", label: "Weight" },
  { key: "dimensions", label: "Dimensions" },
  { key: "warranty", label: "Warranty" },
  { key: "features", label: "Features" },
  { key: "benefits", label: "Benefits" },
];

function fieldSatisfied(key: keyof ProductProfileFields, fields: ProductProfileFields): boolean {
  const value = fields[key];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  return String(value ?? "").trim().length > 0;
}

/** Real readiness gate — only name, price, and images block production. */
export function deriveProductReadiness(
  fields: ProductProfileFields,
  imageCount: number,
  validations: FieldValidation[],
): ProductReadiness {
  const required: ReadinessFieldRow[] = REQUIRED_FIELDS.map(({ key, label }) => {
    if (key === "images") {
      const ok = imageCount >= 1;
      return { field: key, label, satisfied: ok, status: ok ? "ok" : "error" };
    }
    if (key === "price") {
      const ok = fields.price != null && Number.isFinite(fields.price) && fields.price >= 0;
      return {
        field: key,
        label,
        satisfied: ok,
        status: ok ? "ok" : "error",
      };
    }
    const ok = fieldSatisfied(key, fields);
    return { field: key, label, satisfied: ok, status: ok ? "ok" : "error" };
  });

  const optional: ReadinessFieldRow[] = OPTIONAL_FIELDS.map(({ key, label }) => {
    const ok = fieldSatisfied(key, fields);
    return { field: key, label, satisfied: ok, status: ok ? "ok" : "missing" };
  });

  const formatErrors = validations.filter((v) => v.status === "error" && !["name", "price", "currency", "images"].includes(v.field));
  const missingRequired = required.filter((r) => !r.satisfied);
  const canProceed = missingRequired.length === 0 && formatErrors.length === 0;

  let state: ProductReadinessState;
  if (!canProceed) {
    state = "MISSING_REQUIRED_INFORMATION";
  } else if (optional.some((o) => !o.satisfied)) {
    state = "OPTIONAL_INFORMATION_MISSING";
  } else {
    state = "READY_FOR_AI_PROCESSING";
  }

  const blockedReason = !canProceed
    ? (missingRequired[0]?.label
      ? `${missingRequired[0].label} is required.`
      : formatErrors[0]?.message ?? "Required product information is missing.")
    : null;

  const message = canProceed
    ? state === "OPTIONAL_INFORMATION_MISSING"
      ? "READY FOR AI PROCESSING — optional fields can enrich the result."
      : "READY FOR AI PROCESSING"
    : blockedReason ?? "MISSING REQUIRED INFORMATION";

  return {
    state,
    canGenerateVideo: canProceed,
    canContinueToMarketing: canProceed,
    blockedReason,
    required,
    optional,
    message,
  };
}
