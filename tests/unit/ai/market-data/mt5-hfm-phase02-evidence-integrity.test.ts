/**
 * Phase 02 — unified evidence integrity (fixtures only).
 */
import { describe, it, expect } from "vitest";
import {
  assembleMarketEvidencePackage,
  prioritizeEvidenceItemsForCap,
  scrubEvidenceRefsToKeptSet,
  filterIdsToAllowlist,
  isParseableIsoTimestamp,
  adaptDetectionEvidenceRefToEvidence,
} from "../../../../ai/market-data/mt5-hfm/mif/market-evidence/index";
import type { MifDetectionEvidenceRef } from "../../../../ai/market-data/mt5-hfm/mif/opportunity-detection/types";
import { verifyUnifiedPackageIdentity } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/unified-input";

function makeRef(evidenceId: string): MifDetectionEvidenceRef {
  return {
    evidenceId,
    family: "MARKET_REGIME",
    presence: "PRESENT",
    sourceEngine: "mif-market-regime",
    sourceContractId: "c",
    sourceContractVersion: "1.0.0",
    sourcePolicyVersion: null,
    sourceAssessmentId: "a1",
    sourceInputIdentity: null,
    timeframe: "H1",
    timeframeRole: "PRIMARY",
    assessmentTimestamp: "2026-01-01T00:00:00.000Z",
    qualityStatus: "VALID",
    candleState: "CLOSED",
  };
}

describe("Phase 02 timestamp integrity", () => {
  it("rejects non-parseable ISO-like strings", () => {
    expect(isParseableIsoTimestamp("XXXXXXXXXX")).toBe(false);
    expect(isParseableIsoTimestamp("2026-01-01T00:00:00.000Z")).toBe(true);
  });
});

describe("Phase 02 dangling ref scrub", () => {
  it("removes citations to dropped evidence ids", () => {
    const a = adaptDetectionEvidenceRefToEvidence(makeRef("tc.regime"), {
      providerSymbol: "EURUSD",
      observedAt: "2026-01-01T00:00:00.000Z",
      snapshotId: "snap-1",
    });
    const b = {
      ...adaptDetectionEvidenceRefToEvidence(makeRef("cand.1"), {
        providerSymbol: "EURUSD",
        observedAt: "2026-01-01T00:00:00.000Z",
        snapshotId: "snap-1",
      }),
      evidenceId: "cand.1",
      supportingEvidenceIds: ["tc.regime", "missing.ref"],
      conflictingEvidenceIds: ["also.missing"],
      limitations: [],
    };
    const { items, danglingRefCount } = scrubEvidenceRefsToKeptSet([a, b]);
    expect(danglingRefCount).toBe(2);
    const cand = items.find((i) => i.evidenceId === "cand.1")!;
    expect(cand.supportingEvidenceIds).toEqual(["tc.regime"]);
    expect(cand.conflictingEvidenceIds).toEqual([]);
  });

  it("assembleMarketEvidencePackage scrubs dangling refs after cap", () => {
    const catalog = adaptDetectionEvidenceRefToEvidence(makeRef("tc.regime"), {
      providerSymbol: "EURUSD",
      observedAt: "2026-01-01T00:00:00.000Z",
      snapshotId: "snap-1",
    });
    const many = Array.from({ length: 130 }, (_, i) => {
      const base = adaptDetectionEvidenceRefToEvidence(makeRef(`filler.${i}`), {
        providerSymbol: "EURUSD",
        observedAt: "2026-01-01T00:00:00.000Z",
        snapshotId: "snap-1",
      });
      return {
        ...base,
        supportingEvidenceIds: i === 0 ? ["tc.regime", "ghost.id"] : [],
      };
    });
    const pkg = assembleMarketEvidencePackage({
      items: [catalog, ...many],
      providerSymbol: "EURUSD",
      snapshotId: "snap-1",
      snapshotIdSourceVerified: true,
    });
    expect(pkg.items.some((i) => i.evidenceId === "tc.regime")).toBe(true);
    expect(pkg.warnings.some((w) => /dangling_refs_scrubbed=/.test(w))).toBe(true);
    for (const it of pkg.items) {
      for (const id of it.supportingEvidenceIds) {
        expect(pkg.items.some((x) => x.evidenceId === id)).toBe(true);
      }
    }
  });
});

describe("Phase 02 symbol / snapshot package checks", () => {
  it("warns on symbol mismatch without failing package assembly", () => {
    const ok = adaptDetectionEvidenceRefToEvidence(makeRef("tc.regime"), {
      providerSymbol: "EURUSD",
      observedAt: "2026-01-01T00:00:00.000Z",
      snapshotId: "snap-1",
    });
    const bad = {
      ...adaptDetectionEvidenceRefToEvidence(makeRef("tc.mtf"), {
        providerSymbol: "GBPUSD",
        observedAt: "2026-01-01T00:00:00.000Z",
        snapshotId: "snap-1",
      }),
    };
    const pkg = assembleMarketEvidencePackage({
      items: [ok, bad],
      providerSymbol: "EURUSD",
      snapshotId: "snap-1",
      snapshotIdSourceVerified: true,
    });
    expect(pkg.warnings.some((w) => /symbol_mismatch_count=/.test(w))).toBe(true);
    expect(pkg.limitations.some((l) => /symbol_mismatch/.test(l))).toBe(true);
  });
});

describe("Phase 02 allowlist filtering", () => {
  it("filterIdsToAllowlist drops unknown ids", () => {
    const { ids, dropped } = filterIdsToAllowlist(
      ["tc.regime", "ghost"],
      new Set(["tc.regime"]),
    );
    expect(ids).toEqual(["tc.regime"]);
    expect(dropped).toEqual(["ghost"]);
  });

  it("prioritizeEvidenceItemsForCap still prefers catalog refs", () => {
    const catalog = adaptDetectionEvidenceRefToEvidence(makeRef("tc.regime"), {
      providerSymbol: "EURUSD",
      observedAt: "2026-01-01T00:00:00.000Z",
    });
    const filler = Array.from({ length: 5 }, (_, i) =>
      adaptDetectionEvidenceRefToEvidence(makeRef(`f.${i}`), {
        providerSymbol: "EURUSD",
        observedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    const { kept } = prioritizeEvidenceItemsForCap([catalog, ...filler], 3);
    expect(kept.some((k) => k.evidenceId === "tc.regime")).toBe(true);
  });
});

describe("Phase 02 Charts snapshot requirement", () => {
  it("rejects evidence package with missing snapshotId on Charts unify path", () => {
    const verified = verifyUnifiedPackageIdentity({
      snapshotId: "snap-expected",
      snapshotHash: "hash",
      symbol: "EURUSD",
      orchestration: {
        snapshotId: "snap-expected",
        snapshotHash: "hash",
        providerSymbol: "EURUSD",
        evidencePackage: {
          packageId: "ep-1",
          contractId: "kwizera.mif.market-evidence-package.v1",
          contractVersion: "1.0.0",
          snapshotId: null,
          providerSymbol: "EURUSD",
          items: [],
        },
      },
      scenarioPackage: null,
    });
    expect(verified.rejected).toContain("evidence_package_snapshot_missing");
    expect(verified.evidencePackage).toBeNull();
  });
});
