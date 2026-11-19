/**
 * Phase 5D Step 2 — detection context validation.
 */
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import { MIF_OD_DUPLICATE_EVIDENCE, MIF_OD_INVALID_CONTEXT, MIF_OD_MIXED_INSTRUMENTS } from "./codes.js";
import type { MifOpportunityDetectionContext } from "./types.js";

export interface MifContextValidation {
  ok: boolean;
  errors: string[];
  reasonCodes: Array<typeof MIF_OD_INVALID_CONTEXT | typeof MIF_OD_MIXED_INSTRUMENTS | typeof MIF_OD_DUPLICATE_EVIDENCE>;
}

export function validateOpportunityDetectionContext(
  ctx: MifOpportunityDetectionContext | null | undefined,
): MifContextValidation {
  const errors: string[] = [];
  const reasonCodes: MifContextValidation["reasonCodes"] = [];
  if (!ctx) {
    return { ok: false, errors: ["context missing"], reasonCodes: [MIF_OD_INVALID_CONTEXT] };
  }
  if (ctx.providerId !== MIF_PROVIDER_ID) {
    errors.push("providerId must be HFM_MT5");
    reasonCodes.push(MIF_OD_INVALID_CONTEXT);
  }
  const sym = String(ctx.providerSymbol || "").trim().toUpperCase();
  if (!sym) {
    errors.push("providerSymbol missing");
    reasonCodes.push(MIF_OD_INVALID_CONTEXT);
  }
  if (!ctx.assessmentTimestamp?.trim()) {
    errors.push("assessmentTimestamp missing");
    reasonCodes.push(MIF_OD_INVALID_CONTEXT);
  }
  if (!ctx.contextVersion?.trim()) {
    errors.push("contextVersion missing");
    reasonCodes.push(MIF_OD_INVALID_CONTEXT);
  }
  if (ctx.placesOrders !== false || ctx.mutatesBroker !== false || ctx.acceptsForExecution !== false) {
    errors.push("safety flags must be false");
    reasonCodes.push(MIF_OD_INVALID_CONTEXT);
  }
  if (ctx.doesNotApproveAiReasoning !== true || ctx.analyticalDetectionContextOnly !== true) {
    errors.push("analytical safety markers required");
    reasonCodes.push(MIF_OD_INVALID_CONTEXT);
  }

  // Mixed instruments via assessment refs
  const symbols = new Set<string>();
  if (sym) symbols.add(sym);
  if (ctx.instrument?.providerSymbol) {
    symbols.add(String(ctx.instrument.providerSymbol).trim().toUpperCase());
  }
  for (const a of [ctx.regime, ctx.harmonic, ctx.fibonacci, ctx.chartPatterns, ctx.unified, ctx.mtfRelationships]) {
    if (a?.providerSymbol) symbols.add(String(a.providerSymbol).trim().toUpperCase());
  }
  if (symbols.size > 1) {
    errors.push(`mixed instruments: ${[...symbols].sort().join(",")}`);
    reasonCodes.push(MIF_OD_MIXED_INSTRUMENTS);
  }

  // Duplicate evidence IDs
  const ids = new Set<string>();
  for (const e of ctx.evidence ?? []) {
    if (!e.evidenceId) {
      errors.push("evidenceId missing");
      reasonCodes.push(MIF_OD_INVALID_CONTEXT);
      continue;
    }
    if (ids.has(e.evidenceId)) {
      errors.push(`duplicate evidenceId ${e.evidenceId}`);
      reasonCodes.push(MIF_OD_DUPLICATE_EVIDENCE);
    }
    ids.add(e.evidenceId);
  }

  if (ctx.timebase === "UNKNOWN") {
    // warning-level only — not hard fail
  }

  return { ok: errors.length === 0, errors, reasonCodes: [...new Set(reasonCodes)] };
}
