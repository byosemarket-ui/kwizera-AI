import type { CompletenessBreakdown, FieldValidation, ProductProfileFields, ProductVariant } from "./types";
import { categorySpecHints } from "./types";

export function validateProfileFields(
  fields: ProductProfileFields,
  imageCount: number,
): FieldValidation[] {
  const rows: FieldValidation[] = [];
  const push = (field: string, status: FieldValidation["status"], message: string) => {
    rows.push({ field, status, message });
  };

  if (!fields.name.trim()) push("name", "error", "Product name is required.");
  else push("name", "ok", "Product name");

  if (!fields.category.trim()) push("category", "error", "Category is required.");
  else push("category", "ok", "Category");

  if (fields.price == null || !Number.isFinite(fields.price) || fields.price < 0) {
    push("price", "error", "A valid selling price is required.");
  } else push("price", "ok", "Price");

  if (fields.price != null && !fields.currency.trim()) {
    push("currency", "error", "Currency is required when a price is set.");
  } else if (fields.currency.trim()) push("currency", "ok", "Currency");

  if (fields.originalPrice != null && fields.price != null && fields.originalPrice < fields.price) {
    push("originalPrice", "warning", "Original price is lower than selling price.");
  }

  if (!fields.description.trim() && !fields.shortDescription.trim()) {
    push("description", "warning", "Description is empty.");
  } else push("description", "ok", "Description");

  if (!fields.colors.length) push("colors", "warning", "No product color specified.");
  else push("colors", "ok", "Colors");

  if (!fields.brand.trim()) push("brand", "warning", "Brand is empty.");
  else push("brand", "ok", "Brand");

  if (fields.sku && !/^[A-Za-z0-9._-]{2,64}$/.test(fields.sku)) {
    push("sku", "error", "SKU contains invalid characters.");
  } else if (fields.sku) push("sku", "ok", "SKU");

  if (fields.barcode && !/^[0-9]{8,14}$/.test(fields.barcode.replace(/\s/g, ""))) {
    push("barcode", "warning", "Barcode should be 8–14 digits.");
  }

  if (imageCount < 1) push("images", "error", "At least one product image is required.");
  else push("images", "ok", "Images");

  return rows;
}

export function computeCompleteness(
  fields: ProductProfileFields,
  imageCoverage: number,
  variants: ProductVariant[],
): CompletenessBreakdown {
  const infoChecks: Array<[boolean, string]> = [
    [Boolean(fields.name.trim()), "Product name"],
    [Boolean(fields.brand.trim()), "Brand"],
    [Boolean(fields.category.trim()), "Category"],
    [fields.price != null && fields.price >= 0, "Price"],
    [Boolean(fields.currency.trim()), "Currency"],
    [Boolean(fields.shortDescription.trim() || fields.description.trim()), "Description"],
    [fields.features.length > 0 || fields.highlights.length > 0, "Features"],
    [fields.colors.length > 0, "Colors"],
  ];
  const infoDone = infoChecks.filter(([ok]) => ok).length;
  const information = Math.round((infoDone / infoChecks.length) * 100);

  const specKeys = new Set([
    ...Object.keys(fields.specifications),
    ...categorySpecHints(fields.category).map((h) => h.key),
  ]);
  const filledSpecs = [...specKeys].filter((k) => Boolean(fields.specifications[k]?.trim())).length
    + (fields.materials.length ? 1 : 0)
    + (fields.dimensions.trim() ? 1 : 0)
    + (fields.weight.trim() ? 1 : 0)
    + (fields.warranty.trim() ? 1 : 0)
    + (variants.length ? 1 : 0);
  const specDenom = Math.max(4, categorySpecHints(fields.category).length + 4);
  const specifications = Math.min(100, Math.round((filledSpecs / specDenom) * 100));

  const images = Math.max(0, Math.min(100, Math.round(imageCoverage)));
  const overall = Math.round(information * 0.45 + images * 0.3 + specifications * 0.25);

  const missingRecommended: string[] = [];
  if (!fields.materials.length) missingRecommended.push("Material");
  if (!fields.warranty.trim()) missingRecommended.push("Warranty");
  if (!fields.sizes.length && /shoe|apparel|clothing/.test(fields.category.toLowerCase())) {
    missingRecommended.push("Sizes");
  }
  for (const hint of categorySpecHints(fields.category)) {
    if (!fields.specifications[hint.key]?.trim()) missingRecommended.push(hint.label);
  }

  return { information, images, specifications, overall, missingRecommended: missingRecommended.slice(0, 8) };
}

export function listToText(values: string[]): string {
  return values.join(", ");
}

export function textToList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
