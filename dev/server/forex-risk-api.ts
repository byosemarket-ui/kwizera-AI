/**
 * Phase 45 — Forex risk settings + deterministic position-risk calculate API.
 * Admin mutations require requireForexAdmin. Calculate may accept optional verified contract override.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  calculatePositionRisk,
  getForexRiskSettingsService,
  validateForexRiskSettingsPatch,
  type ForexRiskSettings,
  type InstrumentContractSpec,
} from "../../ai/forex-ai/position-sizing/index.js";
import { requireForexAdmin } from "./forex-admin-auth.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage, max = 32_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > max) throw Object.assign(new Error("Body too large"), { code: "PAYLOAD_TOO_LARGE" });
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

const SAFE_KEYS = new Set([
  "riskBudgetMode",
  "riskPercent",
  "riskFixedAmount",
  "riskBasis",
  "manualBalance",
  "manualEquity",
  "accountCurrency",
  "minRewardRiskRatio",
  "calculationMode",
  "proposedSize",
  "conversionMaxAgeMs",
  "requireMarginForEligibility",
]);

export async function handleForexRiskApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (
    !url.pathname.startsWith("/api/forex-admin/risk-settings")
    && url.pathname !== "/api/forex/risk/calculate"
  ) {
    return false;
  }

  try {
    if (url.pathname.startsWith("/api/forex-admin/risk-settings")) {
      if (!requireForexAdmin(req, res, sendJson, url.pathname)) return true;
      const store = getForexRiskSettingsService();

      if (url.pathname === "/api/forex-admin/risk-settings" || url.pathname === "/api/forex-admin/risk-settings/") {
        if (req.method === "GET" || req.method === "HEAD") {
          const settings = await store.getSettings();
          const audit = await store.getAudit();
          sendJson(res, 200, {
            ok: true,
            settings,
            audit: audit.slice(0, 40),
            note:
              "Deterministic risk settings only. No broker execution. "
              + "Manual balance/equity until ForexConnect Accounts are wired.",
          });
          return true;
        }
        if (req.method === "PATCH" || req.method === "PUT") {
          const body = await readJsonBody(req) as Record<string, unknown>;
          const patch: Partial<ForexRiskSettings> = {};
          for (const key of SAFE_KEYS) {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
              (patch as Record<string, unknown>)[key] = body[key];
            }
          }
          const validated = validateForexRiskSettingsPatch(patch);
          if (!validated.ok) {
            sendJson(res, 422, { ok: false, error: { code: "INVALID_SETTINGS", message: validated.message } });
            return true;
          }
          const result = await store.updateSettings(validated.settings);
          if ("error" in result) {
            sendJson(res, 422, { ok: false, error: { code: "INVALID_SETTINGS", message: result.error } });
            return true;
          }
          sendJson(res, 200, { ok: true, settings: result.settings, changed: result.changed });
          return true;
        }
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or PATCH." } });
        return true;
      }
    }

    if (url.pathname === "/api/forex/risk/calculate") {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      // Public calculate uses saved settings; does not expose secrets.
      const body = await readJsonBody(req) as {
        side?: string;
        entryPrice?: number;
        stopLoss?: number;
        takeProfit?: number | null;
        proposedSize?: number | null;
        calculationMode?: string;
        bid?: number | null;
        ask?: number | null;
        contract?: InstrumentContractSpec;
        conversionQuotes?: Array<{
          base: string;
          quote: string;
          bid: number | null;
          ask: number | null;
          source: string;
          observedAt: string;
        }>;
        commissionAccount?: number | null;
      };

      if (!body.contract || body.contract.verified !== true) {
        sendJson(res, 422, {
          ok: false,
          error: {
            code: "CONTRACT_UNVERIFIED",
            message:
              "A verified instrument contract specification is required. "
              + "Do not invent pip/lot/ounce values.",
          },
        });
        return true;
      }

      const settings = await getForexRiskSettingsService().getSettings();
      const side = body.side === "BUY" || body.side === "SELL" ? body.side : null;
      const result = calculatePositionRisk({
        settings,
        contract: body.contract,
        side,
        entryPrice: typeof body.entryPrice === "number" ? body.entryPrice : null,
        stopLoss: typeof body.stopLoss === "number" ? body.stopLoss : null,
        takeProfit: typeof body.takeProfit === "number" ? body.takeProfit : null,
        proposedSize: typeof body.proposedSize === "number" ? body.proposedSize : null,
        calculationMode:
          body.calculationMode === "size_first" || body.calculationMode === "risk_budget_first"
            ? body.calculationMode
            : undefined,
        bid: body.bid,
        ask: body.ask,
        conversionQuotes: body.conversionQuotes,
        commissionAccount: body.commissionAccount,
      });
      sendJson(res, 200, {
        ok: true,
        result,
        note: "Decision-support only. Does not place broker orders.",
      });
      return true;
    }

    sendJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Unknown risk route." } });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Risk API failed.";
    sendJson(res, 500, {
      ok: false,
      error: {
        code: "RISK_API_ERROR",
        message: message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]"),
      },
    });
    return true;
  }
}
