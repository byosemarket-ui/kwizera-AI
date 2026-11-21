import type {
  HFM_ECONOMIC_EVENT_CONTRACT_ID,
  HFM_ECONOMIC_EVENT_CONTRACT_VERSION,
  HFM_FUNDAMENTALS_PACKAGE_CONTRACT_ID,
  HFM_FUNDAMENTALS_PACKAGE_CONTRACT_VERSION,
  HfmEconomicConfidence,
  HfmEconomicEventStatus,
  HfmEconomicFreshness,
  HfmFundamentalsAvailability,
} from "./contracts.js";

export interface HfmEconomicAttribution {
  required: boolean;
  text: string;
  url: string;
}

export interface HfmEconomicEvent {
  contractId: typeof HFM_ECONOMIC_EVENT_CONTRACT_ID;
  contractVersion: typeof HFM_ECONOMIC_EVENT_CONTRACT_VERSION;
  eventId: string;
  providerId: "SHOWMYTRADES";
  providerEventId: string;
  title: string;
  currency: string;
  country: string | null;
  category: string;
  impact: string;
  scheduledAtUtc: string;
  scheduledTs: number;
  originalTimezone: string | null;
  forecast: string;
  previous: string;
  actual: string;
  unit: string | null;
  period: string;
  status: HfmEconomicEventStatus;
  movedFrom: string;
  confidence: HfmEconomicConfidence;
  sourceUrl: string | null;
  retrievedAtUtc: string;
  publishedAtUtc: string | null;
  freshness: HfmEconomicFreshness;
  completeness: "COMPLETE" | "PARTIAL" | "MISSING_VALUES";
  qualityWarnings: string[];
  revisionOfEventId: string | null;
  /** Informational only — never a trade signal. */
  analyticalOnly: true;
  doesNotApproveExecution: true;
}

export interface HfmEventImpactSummary {
  eventId: string;
  importance: "HIGH" | "MEDIUM" | "LOW" | "HOLIDAY" | "UNKNOWN";
  relevantCurrencies: string[];
  relevantInstruments: string[];
  forecastAvailable: boolean;
  previousAvailable: boolean;
  actualAvailable: boolean;
  surprise: string | null;
  surpriseComparable: boolean;
  directionalImplication: "UNSPECIFIED" | "BULLISH_FOR_CURRENCY" | "BEARISH_FOR_CURRENCY";
  volatilityWindowNote: string;
}

export interface HfmFundamentalsPackage {
  contractId: typeof HFM_FUNDAMENTALS_PACKAGE_CONTRACT_ID;
  contractVersion: typeof HFM_FUNDAMENTALS_PACKAGE_CONTRACT_VERSION;
  packageId: string;
  snapshotId: string;
  symbol: string;
  asOfUtc: string;
  availability: HfmFundamentalsAvailability;
  freshness: HfmEconomicFreshness;
  completeness: "COMPLETE" | "PARTIAL" | "EMPTY" | "DISABLED";
  providerId: "SHOWMYTRADES" | null;
  eventIds: string[];
  events: HfmEconomicEvent[];
  impacts: HfmEventImpactSummary[];
  attribution: HfmEconomicAttribution | null;
  qualityWarnings: string[];
  rankingUnaffected: true;
  informationalOnly: true;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

export interface HfmFundamentalsProviderState {
  providerId: "SHOWMYTRADES";
  lastSuccessAtUtc: string | null;
  lastAttemptAtUtc: string | null;
  lastError: string | null;
  etag: string | null;
  lastServerTime: number | null;
  lastCount: number | null;
  attribution: HfmEconomicAttribution | null;
  backgroundRefreshEnabled: false;
}
