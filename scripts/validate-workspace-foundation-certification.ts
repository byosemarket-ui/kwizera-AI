/**
 * Workspace Foundation Certification — Phase 1 Step 10
 * Runs the certification engine in Node with a localStorage polyfill and writes the report.
 */
import fs from "node:fs";
import path from "node:path";

const store = new Map<string, string>();
const localStoragePolyfill = {
  getItem(key: string) {
    return store.has(key) ? store.get(key)! : null;
  },
  setItem(key: string, value: string) {
    store.set(key, String(value));
  },
  removeItem(key: string) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
  key(index: number) {
    return [...store.keys()][index] ?? null;
  },
  get length() {
    return store.size;
  },
};

(globalThis as { localStorage?: typeof localStoragePolyfill }).localStorage = localStoragePolyfill;
(globalThis as { sessionStorage?: typeof localStoragePolyfill }).sessionStorage = localStoragePolyfill;
(globalThis as { window?: object }).window = {
  addEventListener() {},
  removeEventListener() {},
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  localStorage: localStoragePolyfill,
};
(globalThis as { document?: object }).document = {
  visibilityState: "visible",
  addEventListener() {},
  removeEventListener() {},
};
(globalThis as { performance?: Performance }).performance ??= {
  now: () => Date.now(),
} as Performance;

async function main() {
  const { workspaceIntegrationEngine } = await import("../desktop/shell/integration/integration-engine.ts");
  const { workspaceCertificationEngine } = await import("../desktop/shell/certification/certification-engine.ts");

  workspaceIntegrationEngine.start();
  const result = workspaceCertificationEngine.run();
  const markdown = workspaceCertificationEngine.toMarkdown();

  const reportPath = path.join(process.cwd(), "desktop", "shell", "WORKSPACE-FOUNDATION-CERTIFICATION-REPORT.md");
  fs.writeFileSync(reportPath, markdown, "utf8");

  const rootCopy = path.join(process.cwd(), "WORKSPACE-FOUNDATION-CERTIFICATION-REPORT.md");
  fs.writeFileSync(rootCopy, markdown, "utf8");

  console.log(`Certified: ${result.certified ? "YES" : "NO"}`);
  console.log(`Overall: ${result.overallScore}/100 · Stability ${result.stabilityScore} · Perf ${result.performanceScore} · UX ${result.uxScore}`);
  console.log(`Readiness: ${result.readiness}`);
  console.log(`Report: ${reportPath}`);
  if (!result.certified) {
    console.error("Blockers:");
    for (const b of result.blockers) console.error(` - ${b}`);
    process.exitCode = 1;
  }

  workspaceIntegrationEngine.stop();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
