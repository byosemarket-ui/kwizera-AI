# Phase 4.10 — DEMO 0.01-lot instrument discovery (read-only)

## Safety

No broker mutations, grants, owner-confirm changes, armed_execute, or continuous worker.

## Conversion

`AMOUNT = baseUnitSize × lots` — must be a positive integer and `≥ minQuantity`.

## Live DEMO catalog snapshot (broker-backed)

Fetched from production ForexConnect instruments while CONNECTED (DEMO).

| Observation | Live evidence |
|---|---|
| Instrument count | 516 |
| `baseUnitSize` present | 516 / 516 |
| `minQuantity` present | 516 / 516 |
| `mmrPerLot` present | 10 / 516 |
| Typical FX pair | `baseUnitSize=1000`, `minQuantity=1000` → **min lots = 1.0** |
| Typical CFD/metal (`XAU/USD`) | `baseUnitSize=1`, `minQuantity=1`, `mmrPerLot` present → 0.01 → non-integer AMOUNT |
| Compatible with owner **0.01** lots + live MMR | **0** |

For every scanned row, `minQuantity / baseUnitSize = 1` when both fields are present. Therefore **0.01 lots is below the broker minimum on this DEMO account** for all instruments; do not raise the owner limit as a workaround in this phase.

## XAU/USD (live)

| Field | Value |
|---|---:|
| baseUnitSize | 1 |
| minQuantity | 1 |
| mmrPerLot | 4.42 (live; not the historical 4.79 doc value) |
| 0.01 conversion | **BLOCKED** (`AMOUNT_NOT_INTEGER`) |

## Tooling

- Offline scorer: `ai/forex-ai/automated-trading/order-execution/discover-001-lot-instruments.ts`
- VPS RO script: `scripts/phase410-vps-ro-instrument-discovery.mjs`
- Workflow: `.github/workflows/phase410-demo-instrument-discovery.yml`
- Unit tests: **mock fixtures only** — `tests/unit/ai/forex-ai/phase410-discover-001-lot-instruments.test.ts`
