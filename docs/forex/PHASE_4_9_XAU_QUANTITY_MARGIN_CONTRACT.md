# Phase 4.9 — XAU/USD ForexConnect quantity and margin contract

## Safety

Read-only / offline analysis and fail-closed repairs only. No broker mutations, grants, owner-confirm flips, or activation.

## Authoritative conversion

```
UI lots  →  amount = baseUnitSize × lots  →  ForexConnect integer AMOUNT
```

Sources: Gehtsoft `OpenPosition` sample, `mutation_demo.open_true_market`, TradingSettingsProvider.

## Documented live DEMO XAU/USD probe (Phase 59.0.6)

| Field | Value | Meaning |
|-------|------:|---------|
| baseUnitSize | 1 | Units per 1.0 lot |
| minQuantity | 1 | Minimum AMOUNT (contracts) |
| lotStep | 1 | Sidecar alias of minQuantity (not a fractional invention) |
| mmrPerLot | 4.79 | Absolute margin for **1.0 lot** (not a rate) |
| pointSize / pipCost | 0.01 / 0.01 | Offers |

Therefore:

| Requested lots | Raw amount | Integer AMOUNT? | Supported? |
|---------------:|-----------:|:---------------:|:----------:|
| 1.0 | 1 | Yes | Yes (min) |
| 0.01 | 0.01 | No | **No** |

`minLotsFromBroker = minQuantity / baseUnitSize = 1`.

Owner bound `maxLotsPerOrder = 0.01` is **below** broker minimum. Do not round up to 1.0 lot.

## Margin

- Authoritative field: TradingSettings `get_mmr` / `getMMR` → `mmrPerLot`.
- Estimated margin for a request: `mmrPerLot × lots`.
- If `mmrPerLot` is null after SDK probe (including alternate account-id argument forms), margin preflight stays **fail-closed**. Never invent MMR from usable margin alone.

## Code

- `order-execution/broker-quantity-contract.ts` — single offline evaluator
- Wired into open-market risk + activation readiness + Phase 47 RO report
- Sidecar HTTP open-market preserves fractional `lots` (float); AMOUNT still must be integer
