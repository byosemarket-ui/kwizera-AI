/**
 * STEP 2A — Authoritative Brand Identity contract for Video Plan → End Card.
 * Project-scoped; never hard-codes company contacts.
 */
import type {
  BrandInformation,
  CreativeProject,
  ProductImage,
} from "./creative-workspace-manager.js";

export const BRAND_IDENTITY_VERSION = "step2a-brand-identity-v1";

export interface BrandIdentity {
  version: typeof BRAND_IDENTITY_VERSION;
  projectId: string;
  brandName: string;
  websiteName: string;
  websiteUrl: string;
  phone: string;
  whatsapp: string;
  email: string;
  cta: string;
  logoAssetId: string | null;
  language: string;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Normalize common website input without inventing a different site. */
export function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function isDisplayablePhone(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  // Allow international formats with spaces/dashes; require enough digits.
  const digits = t.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 && /^[+0-9()\s.-]+$/.test(t);
}

export function isBrandLogoAsset(image: Pick<ProductImage, "assetType" | "assetRole" | "origin">): boolean {
  return image.assetRole === "brand-logo"
    || (image.assetType === "document" && image.origin === "upload");
}

export function extractBrandIdentity(project: CreativeProject): BrandIdentity {
  const brand = project.brandInformation ?? ({ name: "" } as BrandInformation);
  const info = project.productInformation ?? {};
  const specs = (info.specifications ?? {}) as Record<string, string>;
  const campaign = project.campaignInformation;

  const brandName = asText(brand.name) || asText(info.brand);
  const websiteUrl = normalizeWebsiteUrl(
    asText(brand.website)
    || asText((info as { website?: string }).website)
    || asText(specs.website),
  );
  const websiteName = brandName;
  const phone = asText((brand as { phone?: string }).phone)
    || asText((info as { phone?: string }).phone)
    || asText((info as { contact?: string }).contact);
  const email = asText((info as { email?: string }).email);
  const whatsapp = asText((brand as { whatsapp?: string }).whatsapp);
  const cta = asText(campaign?.callToAction)
    || asText((info as { callToAction?: string }).callToAction)
    || asText((info as { cta?: string }).cta);
  const logoAssetId = asText(brand.logoAssetId) || null;

  return {
    version: BRAND_IDENTITY_VERSION,
    projectId: project.id,
    brandName,
    websiteName,
    websiteUrl,
    phone,
    whatsapp,
    email,
    cta,
    logoAssetId,
    language: asText(project.language) || "English",
  };
}

/** Validate brand identity before end-card render. Non-blocking warnings preferred. */
export function validateBrandIdentityForEndCard(
  identity: BrandIdentity,
  logoExists: boolean,
): { ok: boolean; warnings: string[]; issues: string[] } {
  const warnings: string[] = [];
  const issues: string[] = [];
  if (!identity.projectId) issues.push("Brand identity missing projectId.");
  if (identity.logoAssetId && !logoExists) {
    warnings.push("Logo asset id set but file is missing — text-only end card will be used.");
  }
  if (identity.websiteUrl && !/^https?:\/\//i.test(identity.websiteUrl) && !/^[\w.-]+\.[a-z]{2,}/i.test(identity.websiteUrl)) {
    warnings.push("Website value may not be a valid URL.");
  }
  if (identity.phone && !isDisplayablePhone(identity.phone)) {
    warnings.push("Phone value may not display cleanly.");
  }
  return { ok: issues.length === 0, warnings, issues };
}
