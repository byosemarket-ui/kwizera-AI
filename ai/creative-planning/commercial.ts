export interface ConfirmedCommercial {
  productName: string;
  pricing: {
    currentPrice: number | null;
    originalPrice: number | null;
    currency: string;
    discountPercentage: number | null;
    discountAmount: number | null;
  };
  promotion: {
    enabled: boolean;
    message: string;
  };
  destination: {
    website: string;
    phone: string;
    email: string;
    socialHandle: string;
  };
  issues: string[];
  missing: string[];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Price, promotion, and destination data are optional.
 * Never invent values. Discount is only shown when the numbers support it.
 */
export function buildConfirmedCommercial(input: {
  productName?: string;
  currentPrice?: unknown;
  originalPrice?: unknown;
  currency?: unknown;
  promotionMessage?: unknown;
  promotionEnabled?: unknown;
  website?: unknown;
  phone?: unknown;
  email?: unknown;
  socialHandle?: unknown;
  cta?: unknown;
}): ConfirmedCommercial {
  const issues: string[] = [];
  const missing: string[] = [];
  const currentPrice = asNumber(input.currentPrice);
  const originalPrice = asNumber(input.originalPrice);
  const currency = asText(input.currency) || (currentPrice != null ? "RWF" : "");
  let discountPercentage: number | null = null;
  let discountAmount: number | null = null;

  if (currentPrice == null) missing.push("No confirmed price provided");
  if (!asText(input.website)) missing.push("No website provided");

  if (originalPrice != null && currentPrice != null) {
    if (originalPrice < currentPrice) {
      issues.push("Original price is lower than current price — discount presentation disabled.");
    } else if (originalPrice > currentPrice) {
      discountAmount = originalPrice - currentPrice;
      discountPercentage = Math.round((discountAmount / originalPrice) * 100);
    }
  }

  const promotionMessage = asText(input.promotionMessage);
  const promotionEnabled = Boolean(input.promotionEnabled) || Boolean(promotionMessage) || discountPercentage != null;

  return {
    productName: asText(input.productName),
    pricing: {
      currentPrice,
      originalPrice: issues.some((item) => item.includes("Original price")) ? null : originalPrice,
      currency,
      discountPercentage,
      discountAmount,
    },
    promotion: {
      enabled: promotionEnabled && (Boolean(promotionMessage) || discountPercentage != null),
      message: promotionMessage,
    },
    destination: {
      website: asText(input.website),
      phone: asText(input.phone),
      email: asText(input.email),
      socialHandle: asText(input.socialHandle),
    },
    issues,
    missing,
  };
}

export function formatPrice(amount: number, currency: string): string {
  try {
    return `${amount.toLocaleString("en-US")} ${currency || "RWF"}`;
  } catch {
    return `${amount} ${currency || "RWF"}`;
  }
}

export function priceSceneCopy(commercial: ConfirmedCommercial): { oldPrice?: string; newPrice?: string; saveLabel?: string } {
  const { currentPrice, originalPrice, currency, discountPercentage } = commercial.pricing;
  if (currentPrice == null) return {};
  const newPrice = formatPrice(currentPrice, currency);
  if (originalPrice != null && originalPrice > currentPrice && discountPercentage) {
    return {
      oldPrice: formatPrice(originalPrice, currency),
      newPrice,
      saveLabel: `SAVE ${discountPercentage}%`,
    };
  }
  return { newPrice };
}
