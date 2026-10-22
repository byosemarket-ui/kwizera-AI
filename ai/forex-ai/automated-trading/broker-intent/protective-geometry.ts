/**
 * Phase 57.0 — Local SL/TP geometry and 3R checks.
 * Locally calculated ≠ broker-acknowledged ≠ broker-observed protection.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import type { BrokerIntentRejection, ProtectiveOrderStatus } from "./types.js";

const R_TARGET = 3;
const R_TOLERANCE = 0.05;

export interface ProtectiveGeometryInput {
  direction: AtBinaryDirection | null | undefined;
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  takeProfit: number | null | undefined;
  requireProtective: boolean;
  requireThreeR: boolean;
}

export interface ProtectiveGeometryResult {
  ok: boolean;
  rejections: BrokerIntentRejection[];
  rewardRisk: number | null;
  protectiveStatus: ProtectiveOrderStatus;
  /** Always false in this phase — never claim broker protection. */
  brokerProtected: false;
  placesOrders: false;
  mutatesBroker: false;
}

export function evaluateProtectiveGeometry(
  input: ProtectiveGeometryInput,
): ProtectiveGeometryResult {
  const rejections: BrokerIntentRejection[] = [];
  const dir = input.direction;
  const entry = input.entryPrice;
  const sl = input.stopLoss;
  const tp = input.takeProfit;

  if (input.requireProtective) {
    if (sl == null || !Number.isFinite(sl)) {
      rejections.push({
        code: "STOP_LOSS_REQUIRED",
        message: "Stop Loss is required for protective readiness; none provided.",
      });
    }
    if (tp == null || !Number.isFinite(tp)) {
      rejections.push({
        code: "TAKE_PROFIT_REQUIRED",
        message: "Take Profit is required for protective readiness; none provided.",
      });
    }
  }

  if (dir !== "BUY" && dir !== "SELL") {
    rejections.push({
      code: "DIRECTION_MISSING",
      message: "Direction BUY/SELL is required to validate SL/TP geometry.",
    });
  }

  if (entry == null || !Number.isFinite(entry) || entry <= 0) {
    rejections.push({
      code: "ENTRY_PRICE_INVALID",
      message: "Entry price must be a finite positive number.",
    });
  }

  let rewardRisk: number | null = null;

  if (
    (dir === "BUY" || dir === "SELL")
    && typeof entry === "number"
    && Number.isFinite(entry)
    && entry > 0
    && typeof sl === "number"
    && Number.isFinite(sl)
    && typeof tp === "number"
    && Number.isFinite(tp)
  ) {
    if (dir === "BUY") {
      if (!(sl < entry)) {
        rejections.push({
          code: "STOP_LOSS_GEOMETRY_INVALID",
          message: "BUY Stop Loss must be strictly below entry.",
        });
      }
      if (!(tp > entry)) {
        rejections.push({
          code: "TAKE_PROFIT_GEOMETRY_INVALID",
          message: "BUY Take Profit must be strictly above entry.",
        });
      }
      const risk = entry - sl;
      const reward = tp - entry;
      if (risk > 0) rewardRisk = reward / risk;
    } else {
      if (!(sl > entry)) {
        rejections.push({
          code: "STOP_LOSS_GEOMETRY_INVALID",
          message: "SELL Stop Loss must be strictly above entry.",
        });
      }
      if (!(tp < entry)) {
        rejections.push({
          code: "TAKE_PROFIT_GEOMETRY_INVALID",
          message: "SELL Take Profit must be strictly below entry.",
        });
      }
      const risk = sl - entry;
      const reward = entry - tp;
      if (risk > 0) rewardRisk = reward / risk;
    }

    if (
      input.requireThreeR
      && rewardRisk != null
      && Number.isFinite(rewardRisk)
      && Math.abs(rewardRisk - R_TARGET) > R_TOLERANCE
    ) {
      rejections.push({
        code: "TP_NOT_3R",
        message: `Take Profit must target ~${R_TARGET}R (observed R=${rewardRisk.toFixed(3)}).`,
      });
    }
  }

  return {
    ok: rejections.length === 0,
    rejections,
    rewardRisk,
    // Local calculation never implies broker protection.
    protectiveStatus: "LOCAL_CALCULATED_ONLY",
    brokerProtected: false,
    placesOrders: false,
    mutatesBroker: false,
  };
}

/**
 * Future fill-without-protection fail-safe policy (documentation + pure result).
 * Phase 57.0 must NOT autonomously close a broker position.
 */
export function evaluateUnprotectedFillPolicy(): {
  blockAdditionalEntries: true;
  raiseCriticalAlert: true;
  autonomousCloseAuthorized: false;
  placesOrders: false;
  mutatesBroker: false;
  code: "PROTECTION_UNVERIFIED";
  message: string;
} {
  return {
    blockAdditionalEntries: true,
    raiseCriticalAlert: true,
    autonomousCloseAuthorized: false,
    placesOrders: false,
    mutatesBroker: false,
    code: "PROTECTION_UNVERIFIED",
    message:
      "If a future fill lacks broker-observed protection: block new entries, raise critical alert, require owner incident policy. Do not auto-close in Phase 57.0.",
  };
}
