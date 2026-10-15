/**
 * Phase 45 — Deterministic position sizing & risk management types.
 * AI text never supplies monetary figures.
 */

export const FOREX_POSITION_RISK_SCHEMA = "forex-position-risk-v1";
export const FOREX_RISK_SETTINGS_VERSION = 1 as const;

export type RiskBudgetMode = "percentage" | "fixed";
export type RiskBasis = "manual_balance" | "manual_equity";
export type RiskCalculationMode = "risk_budget_first" | "size_first";
export type QuantityUnit =
  | "lots"
  | "contracts"
  | "base_units"
  | "ounces"
  | "unknown";

export type ContractConvention =
  | "fx_pip_cost_lot"
  | "fx_base_unit"
  | "cfd_multiplier"
  | "crypto_base_qty"
  | "ounce_contract"
  | "unknown";

/** Verified instrument contract fields — never invent missing values. */
export interface InstrumentContractSpec {
  instrumentId: string;
  provider: string;
  quoteCurrency: string | null;
  contractCurrency: string | null;
  convention: ContractConvention;
  /** Pip / point size in price units (FXCM PointSize). */
  pointSize: number | null;
  /** FXCM PipCost: account-currency loss per pip per 1 lot (when available). */
  pipCostAccount: number | null;
  /** Base units per 1.0 lot (TradingSettings BaseUnitSize) when known. */
  baseUnitSize: number | null;
  contractMultiplier: number | null;
  quantityMin: number | null;
  quantityMax: number | null;
  quantityStep: number | null;
  quantityUnit: QuantityUnit;
  tickSize: number | null;
  /** Decimal margin rate when verified as a rate (not FXCM absolute MMR). */
  marginRate: number | null;
  /**
   * Phase 47A — FXCM TradingSettings get_mmr absolute margin for 1 lot
   * (when available). Used for margin estimate; never treated as a rate.
   */
  marginPerLotAccount?: number | null;
  /** True when fields came from provider/admin-verified source. */
  verified: boolean;
  source: string;
  unavailableReason: string | null;
  observedAt: string | null;
}

export interface ConversionRateQuote {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  observedAt: string;
  inverted: boolean;
}

export interface ForexRiskSettings {
  riskBudgetMode: RiskBudgetMode;
  riskPercent: number;
  riskFixedAmount: number | null;
  riskBasis: RiskBasis;
  manualBalance: number | null;
  manualEquity: number | null;
  accountCurrency: string;
  minRewardRiskRatio: number;
  calculationMode: RiskCalculationMode;
  /** Used only in size_first mode when no per-request size is supplied. */
  proposedSize: number | null;
  conversionMaxAgeMs: number;
  /** When true, missing margin blocks eligibility. Default false until provider margin is verified. */
  requireMarginForEligibility: boolean;
}

export const FOREX_RISK_DEFAULT_SETTINGS: ForexRiskSettings = {
  riskBudgetMode: "percentage",
  riskPercent: 1,
  riskFixedAmount: null,
  riskBasis: "manual_balance",
  manualBalance: null,
  manualEquity: null,
  accountCurrency: "",
  minRewardRiskRatio: 1.5,
  calculationMode: "risk_budget_first",
  proposedSize: null,
  conversionMaxAgeMs: 5 * 60_000,
  requireMarginForEligibility: false,
};

export interface PositionRiskCostBreakdown {
  spreadCostAccount: number | null;
  commissionAccount: number | null;
  otherCostsAccount: number | null;
  totalCostsAccount: number | null;
  unavailableReason: string | null;
  isEstimate: boolean;
}

export interface PositionRiskMargin {
  estimatedMarginAccount: number | null;
  unavailableReason: string | null;
  isEstimate: true;
  note: string;
}

export interface PositionRiskResult {
  schemaVersion: typeof FOREX_POSITION_RISK_SCHEMA;
  calculationMode: RiskCalculationMode;
  side: "BUY" | "SELL" | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  accountCurrency: string | null;
  riskBudgetAccount: number | null;
  riskBasisValue: number | null;
  positionSize: number | null;
  positionSizeUnit: QuantityUnit;
  maxPermissibleSize: number | null;
  proposedSize: number | null;
  stopDistancePrice: number | null;
  stopDistancePoints: number | null;
  grossLossAccount: number | null;
  netLossAccount: number | null;
  grossProfitAccount: number | null;
  netProfitAccount: number | null;
  riskPercentOfBasis: number | null;
  rewardRiskRatio: number | null;
  minRewardRiskRatio: number;
  excessRiskAccount: number | null;
  excessRiskPercent: number | null;
  costs: PositionRiskCostBreakdown;
  margin: PositionRiskMargin;
  contract: InstrumentContractSpec;
  conversion: {
    used: ConversionRateQuote | null;
    unavailableReason: string | null;
  };
  riskEligible: boolean;
  blockingReasons: string[];
  notes: string[];
  computedAt: string;
  /** Phase 46 — user allocated capital for the trade (not an acceptable loss). */
  tradeAllocationAmount?: number | null;
  tradeAllocationCurrency?: string | null;
}
