/**
 * Phase 4.10 — Offline analyzer for a saved instruments JSON payload.
 * MOCK/offline vs live: evidence is whatever was fetched into the file.
 * Usage: node scripts/phase410-analyze-instruments-file.mjs <path-to-json>
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/phase410-analyze-instruments-file.mjs <instruments.json>");
  process.exit(2);
}
const j = JSON.parse(readFileSync(path, "utf8"));
const rows = Array.isArray(j.instruments) ? j.instruments : [];
const R = 0.01;
function fp(n) {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

const compat = [];
const qtyOkNoMmr = [];
const hist = {};
let xau = null;

for (const row of rows) {
  const bus = fp(row.baseUnitSize) ? Number(row.baseUnitSize) : null;
  const mq = fp(row.minQuantity) ? Number(row.minQuantity) : null;
  const mmr = fp(row.mmrPerLot) ? Number(row.mmrPerLot) : null;
  const k = bus == null ? "null" : String(bus);
  hist[k] = (hist[k] || 0) + 1;
  const sym = String(row.providerSymbol || "");
  if (/XAU/i.test(sym) && !xau) {
    xau = {
      providerSymbol: sym,
      baseUnitSize: bus,
      minQuantity: mq,
      mmrPerLot: mmr,
      pointSize: row.pointSize ?? null,
      lotStep: row.lotStep ?? null,
      tradingStatus: row.tradingStatus ?? null,
      instrumentType: row.instrumentType ?? null,
    };
  }
  let code = "BASE_UNIT_SIZE_UNKNOWN";
  let amt = null;
  if (bus != null) {
    const raw = bus * R;
    const rounded = Math.round(raw);
    if (Math.abs(raw - rounded) > 1e-9 || rounded <= 0) code = "AMOUNT_NOT_INTEGER";
    else if (mq != null && rounded < mq) code = "AMOUNT_BELOW_MIN_QUANTITY";
    else {
      code = "OK";
      amt = rounded;
    }
  }
  const minLots = bus != null && mq != null ? mq / bus : null;
  const qtyOk = code === "OK" && (minLots == null || R + 1e-12 >= minLots) && mq != null;
  if (qtyOk && mmr != null) {
    compat.push({
      providerSymbol: sym,
      baseUnitSize: bus,
      minQuantity: mq,
      mmrPerLot: mmr,
      integerAmount: amt,
      estimatedMargin: mmr * R,
      tradingStatus: row.tradingStatus ?? null,
      instrumentType: row.instrumentType ?? null,
    });
  } else if (qtyOk && mmr == null) {
    qtyOkNoMmr.push({
      providerSymbol: sym,
      baseUnitSize: bus,
      minQuantity: mq,
      integerAmount: amt,
      tradingStatus: row.tradingStatus ?? null,
    });
  }
}

const out = {
  evidenceSource: "live_broker_file",
  ok: j.ok ?? null,
  scanned: rows.length,
  fetchedAt: j.fetchedAt ?? null,
  baseUnitSizeHistogram: hist,
  withBaseUnitSize: rows.filter((r) => fp(r.baseUnitSize)).length,
  withMinQuantity: rows.filter((r) => fp(r.minQuantity)).length,
  withMmr: rows.filter((r) => fp(r.mmrPerLot)).length,
  compatibleCount: compat.length,
  compatible: compat.slice(0, 40),
  quantityOkMissingMmrCount: qtyOkNoMmr.length,
  quantityOkMissingMmrSample: qtyOkNoMmr.slice(0, 25),
  xauUsd: xau,
  verdict: compat.length > 0
    ? `PASS — ${compat.length} instrument(s) support 0.01 lots with live MMR`
    : "BLOCKED — no instrument supports 0.01 lots with authoritative MMR; do not raise owner size",
};
console.log(JSON.stringify(out, null, 2));
