import type { CertificationCheck, CertificationSnapshot } from "./types";
import { CERT_STORAGE_KEY } from "./types";
import { runFoundationProbes } from "./foundation-probes";
import {
  runAiMeSuite, runDataSafetySuite, runIntegrationSuite, runPerformanceSuite,
  runResponsiveSuite, runStabilitySuite, runUxSuite,
} from "./suites";
import { buildSnapshot } from "./scoring";
import { buildAiMeCertificationContext } from "./aime-certification-awareness";
import { buildCertificationMarkdown } from "./report-builder";

type Listener = (snap: CertificationSnapshot) => void;

const KNOWN_LIMITATIONS = [
  "Deep production engines (image/audio/video/render) land in Phase 2 — event emitters are reserved, not fully wired to media pipelines.",
  "GPU metrics may remain stub/unavailable depending on local hardware sampling.",
  "Some navigation workspaces remain placeholder shells pending product-module implementation.",
  "AI Communication Bus bridging is readiness-flag based; durable cross-process event mirroring is Phase 2+.",
];

export class WorkspaceCertificationEngine {
  private last: CertificationSnapshot | null = null;
  private listeners = new Set<Listener>();
  private running = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.last) listener(this.last);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): CertificationSnapshot | null {
    return this.last;
  }

  buildAiMeContext() {
    return buildAiMeCertificationContext(this.last);
  }

  /** Run full foundation certification. Safe to call repeatedly. */
  run(options?: { persistReport?: boolean; force?: boolean }): CertificationSnapshot {
    if (this.last && !options?.force) return this.last;
    if (this.running && this.last) return this.last;
    this.running = true;
    const issuesFound: string[] = [];
    const issuesRepaired: string[] = [];

    try {
      const aimeSuite = runAiMeSuite();
      const checks: CertificationCheck[] = [
        ...runFoundationProbes(),
        ...runStabilitySuite(),
        ...runResponsiveSuite(),
        ...runPerformanceSuite(),
        ...runUxSuite(),
        ...runIntegrationSuite(),
        ...runDataSafetySuite(),
        ...aimeSuite.checks,
      ];

      for (const check of checks) {
        if (check.status === "fail") issuesFound.push(`${check.label}: ${check.detail}`);
        if (check.status === "repaired") issuesRepaired.push(`${check.label}: ${check.detail}`);
        if (check.status === "warn") issuesFound.push(`WARN ${check.label}: ${check.detail}`);
      }

      // Safe automatic repairs already executed inside suites (prefs, queue).
      // Record structural repairs from probe results.
      const repairedIds = checks.filter((c) => c.status === "repaired").map((c) => c.id);
      if (repairedIds.includes("prefs.validation") || repairedIds.includes("data.prefs-repair")) {
        issuesRepaired.push("Invalid preference values restored to safe defaults");
      }
      if (repairedIds.includes("data.queue-repair") || checks.some((c) => c.id === "data.queue-repair")) {
        issuesRepaired.push("Integration message queue repair pass executed");
      }

      this.last = buildSnapshot({
        checks,
        issuesFound: [...new Set(issuesFound)],
        issuesRepaired: [...new Set(issuesRepaired)],
        remainingLimitations: KNOWN_LIMITATIONS,
        aime: aimeSuite.aime,
      });

      try {
        localStorage.setItem(CERT_STORAGE_KEY, JSON.stringify({
          certified: this.last.certified,
          overallScore: this.last.overallScore,
          readiness: this.last.readiness,
          certifiedAt: this.last.certifiedAt,
          version: this.last.version,
        }));
      } catch {
        /* quota */
      }

      if (options?.persistReport) {
        /* Node script handles filesystem write; browser keeps markdown via getter */
      }

      this.listeners.forEach((l) => l(this.last!));
      return this.last;
    } finally {
      this.running = false;
    }
  }

  toMarkdown(): string {
    const snap = this.last ?? this.run();
    return buildCertificationMarkdown(snap);
  }
}

export const workspaceCertificationEngine = new WorkspaceCertificationEngine();
