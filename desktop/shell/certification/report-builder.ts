import type { CertificationSnapshot } from "./types";
import { FOUNDATION_VERSION } from "./types";

function yesNo(value: boolean): string {
  return value ? "YES" : "NO";
}

function statusLine(label: string, score: number, detail?: string): string {
  const mark = score >= 88 ? "PASS" : score >= 70 ? "WARN" : "FAIL";
  return `**${mark}** — ${label}: **${score}/100**${detail ? ` — ${detail}` : ""}`;
}

export function buildCertificationMarkdown(snap: CertificationSnapshot): string {
  const certBlock = snap.certified
    ? `
---

# CERTIFIED

**KWIZERA AI STUDIO**  
**Product Creation Workspace**  
**Foundation Version ${FOUNDATION_VERSION}**  

**Certified for Professional Product Creation.**

Single User · Local Machine · Offline First · AI Me Preserved

---`
    : `
---

# NOT CERTIFIED

Foundation Version ${FOUNDATION_VERSION} is **not** complete.

## Blockers

${snap.blockers.length ? snap.blockers.map((b) => `- ${b}`).join("\n") : "- See issues below"}

---`;

  return `# WORKSPACE FOUNDATION CERTIFICATION REPORT
## KWIZERA AI STUDIO — Phase 1 Step 10 (Final)

**Foundation Version:** ${FOUNDATION_VERSION}  
**Verified at:** ${snap.certifiedAt}  
**Certified:** ${yesNo(snap.certified)}  
**Readiness:** ${snap.readiness}  
**Offline First:** Preserved  
**Phase 2:** Not started  

${snap.readinessExplanation}

${certBlock}

## 1. Workspace Architecture Status

${statusLine("Architecture", snap.scores.architecture, snap.categories.find((c) => c.id === "architecture")?.status)}

## 2. Navigation Status

${statusLine("Navigation", snap.scores.navigation)}

## 3. Dashboard UI Status

${statusLine("Dashboard & Widgets", snap.scores.dashboard)}

## 4. Layout Manager Status

${statusLine("Layout / Dock / Float", snap.scores.layout)}

## 5. Workspace State Status

${statusLine("State / Session / Auto Save / Preferences", snap.scores.state)}

## 6. Performance Status

${statusLine("Performance", snap.scores.performance)}

## 7. Accessibility Status

${statusLine("Accessibility & Productivity", snap.scores.accessibility)}

## 8. Integration Status

${statusLine("Integration / Event Bus", snap.scores.integration)}

## 9. AI Me Capability

| Capability | Status |
|------------|--------|
| Explain workspace | ${yesNo(snap.aime.canExplainWorkspace)} |
| Explain navigation | ${yesNo(snap.aime.canExplainNavigation)} |
| Explain layouts | ${yesNo(snap.aime.canExplainLayouts)} |
| Explain widgets | ${yesNo(snap.aime.canExplainWidgets)} |
| Guide the user | ${yesNo(snap.aime.canGuideUser)} |
| Monitor workspace health | ${yesNo(snap.aime.canMonitorHealth)} |

## 10. Workspace Stability Score

**${snap.stabilityScore}/100**

## 11. Workspace Performance Score

**${snap.performanceScore}/100**

## 12. User Experience Score

**${snap.uxScore}/100**

## 13. Overall Workspace Score

**${snap.overallScore}/100**

Readiness decision: **${snap.readiness}**  
${snap.readinessExplanation}

## 14. Issues Found

${snap.issuesFound.length ? snap.issuesFound.map((i) => `- ${i}`).join("\n") : "- None"}

## 15. Issues Repaired

${snap.issuesRepaired.length ? snap.issuesRepaired.map((i) => `- ${i}`).join("\n") : "- None required"}

## 16. Remaining Limitations

${snap.remainingLimitations.map((i) => `- ${i}`).join("\n")}

## 17. Is Workspace Foundation Version 1.0 Complete?

**${yesNo(snap.certified)}**

${snap.certified
    ? `KWIZERA AI STUDIO Product Creation Workspace Foundation Version ${FOUNDATION_VERSION} is certified for professional product creation.`
    : `Blockers with technical evidence:\n${snap.blockers.map((b) => `- ${b}`).join("\n")}`}

## Check Inventory

${snap.checks.map((c) => `- [${c.status.toUpperCase()}] (${c.category}) ${c.label} — ${c.detail}`).join("\n")}

## Rules Honored

- Single User Only
- Local Machine Only
- Offline First
- Never certify an unstable workspace
- Never lose user data
- Preserve AI Me
`;
}
