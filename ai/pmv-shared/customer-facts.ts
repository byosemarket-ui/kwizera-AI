/**
 * Customer facts contract: the price, offer, contact details and CTA the customer entered are the only
 * commercial facts a video may state. Pure checks over the rendered text; no provider calls.
 */

export interface CustomerFacts {
  productName: string;
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string;
  discountPercentage: number | null;
  discountAmount: number | null;
  offer: string;
  phone: string;
  whatsapp: string;
  website: string;
  cta: string;
}

export interface CustomerFactsCheck {
  status: "PASS" | "FAIL" | "SKIPPED";
  /** Customer facts that appear in the rendered text. */
  present: string[];
  /** Customer facts that were provided but never shown. */
  missing: string[];
  /** Commercial claims in the rendered text that the customer never provided. */
  invented: string[];
}

const CURRENCY = "(?:rwf|frw|usd|eur|kes|ugx|tzs|ngn|ghs|zar|gbp|\\$|€|£)";
const MONEY_RE = new RegExp(`${CURRENCY}\\s*\\d[\\d,.\\s]*\\d|\\d[\\d,.\\s]*\\d\\s*${CURRENCY}|${CURRENCY}\\s*\\d|\\d\\s*${CURRENCY}`, "gi");
const PERCENT_RE = /(\d{1,3}(?:[.,]\d+)?)\s*%/g;
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|rw|co|io|shop|store|africa|biz|info|app)(?:\.[a-z]{2})?)\b/gi;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function host(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

function amountDigits(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value));
}

/** Last 9 digits identify a phone number regardless of +250 / 0 prefixes and spacing. */
function phoneKey(value: string): string {
  return digits(value).slice(-9);
}

/**
 * `requireContacts`: phone/WhatsApp/website must be shown (true when the contact end card was rendered).
 * Invented details are flagged either way.
 */
export function checkCustomerFacts(facts: CustomerFacts, renderedTexts: string[], options: { requireContacts?: boolean } = {}): CustomerFactsCheck {
  const requireContacts = options.requireContacts !== false;
  const text = renderedTexts.filter(Boolean).join("\n");
  const textDigits = renderedTexts.map(digits);
  const lower = text.toLowerCase();
  const present: string[] = [];
  const missing: string[] = [];
  const invented: string[] = [];
  const note = (label: string, shown: boolean) => (shown ? present : missing).push(label);

  const allowedAmounts = new Set(
    [facts.currentPrice, facts.originalPrice, facts.discountAmount]
      .filter((n): n is number => typeof n === "number")
      .map(amountDigits),
  );
  const allowedPercents = new Set<string>();
  if (typeof facts.discountPercentage === "number") allowedPercents.add(String(Math.round(facts.discountPercentage)));
  for (const match of facts.offer.matchAll(PERCENT_RE)) allowedPercents.add(String(Math.round(Number(match[1]!.replace(",", ".")))));
  for (const match of facts.offer.matchAll(MONEY_RE)) allowedAmounts.add(digits(match[0]));

  if (facts.currentPrice != null) {
    note("price", textDigits.some((d) => d.includes(amountDigits(facts.currentPrice!))));
  }
  if (typeof facts.discountPercentage === "number" && facts.discountPercentage > 0) {
    note("discount", new RegExp(`\\b${Math.round(facts.discountPercentage)}\\s*%`).test(text));
  }
  if (facts.offer.trim()) {
    const offerPercent = [...facts.offer.matchAll(PERCENT_RE)][0]?.[1];
    note("offer", offerPercent
      ? new RegExp(`\\b${Math.round(Number(offerPercent.replace(",", ".")))}\\s*%`).test(text)
      : lower.includes(facts.offer.trim().toLowerCase()));
  }
  const phones = [facts.phone, facts.whatsapp].filter((p) => phoneKey(p).length >= 7);
  if (requireContacts) {
    if (facts.phone && phoneKey(facts.phone).length >= 7) note("phone", textDigits.some((d) => d.includes(phoneKey(facts.phone))));
    if (facts.whatsapp && phoneKey(facts.whatsapp).length >= 7 && phoneKey(facts.whatsapp) !== phoneKey(facts.phone)) {
      note("whatsapp", textDigits.some((d) => d.includes(phoneKey(facts.whatsapp))));
    }
    if (facts.website.trim()) note("website", lower.includes(host(facts.website)));
  }
  if (facts.cta.trim()) note("cta", lower.includes(facts.cta.trim().toLowerCase()));

  for (const match of text.matchAll(MONEY_RE)) {
    const amount = digits(match[0]);
    if (amount && !allowedAmounts.has(amount)) invented.push(`price ${match[0].trim()}`);
  }
  for (const match of text.matchAll(PERCENT_RE)) {
    const pct = String(Math.round(Number(match[1]!.replace(",", "."))));
    if (!allowedPercents.has(pct)) invented.push(`offer ${match[0].trim()}`);
  }
  const allowedHost = host(facts.website);
  for (const match of text.matchAll(URL_RE)) {
    const found = host(match[1]!);
    if (!allowedHost || (found !== allowedHost && !allowedHost.endsWith(`.${found}`) && !found.endsWith(`.${allowedHost}`))) {
      invented.push(`website ${found}`);
    }
  }
  const allowedPhoneKeys = new Set(phones.map(phoneKey));
  for (const match of text.matchAll(PHONE_RE)) {
    const raw = digits(match[0]);
    if (raw.length < 9 || allowedAmounts.has(raw)) continue;
    if (!allowedPhoneKeys.has(raw.slice(-9))) invented.push(`phone ${match[0].trim()}`);
  }

  const anyFacts = present.length + missing.length > 0;
  return {
    status: invented.length || missing.length ? "FAIL" : anyFacts ? "PASS" : "SKIPPED",
    present,
    missing,
    invented: [...new Set(invented)],
  };
}
