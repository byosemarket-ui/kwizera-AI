#!/usr/bin/env node
/**
 * Live verification — Ollama + KWIZERA AI Core deep integration.
 * Does not expose Ollama publicly; probes app status + advisor + optional plan path.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.argv[2] ?? "http://162.35.114.19:5173").replace(/\/$/, "");
const outDir = join(process.cwd(), "step-ollama-deep-artifacts");
mkdirSync(outDir, { recursive: true });

const checks = [];
function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function json(method, path, body, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body != null ? { "Content-Type": "application/json" } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 400) }; }
    return { status: res.status, ok: res.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const health = await json("GET", "/api/health", null, 30000);
  record("app health", health.ok, `status=${health.status}`);

  const status = await json("GET", "/api/creative-director/status", null, 180000);
  const s = status.data?.status ?? {};
  record("creative-director status", status.ok, s.ollamaAdapter?.code ?? s.ollamaNote ?? "");
  record("ollama adapter present", Boolean(s.ollamaAdapter), JSON.stringify(s.ollamaAdapter ?? {}));
  record("video knowledge ready", s.videoKnowledge?.ready === true, `${s.videoKnowledge?.version} count=${s.videoKnowledge?.count}`);
  record("video skills ready", s.videoSkills?.ready === true, `${s.videoSkills?.version} count=${s.videoSkills?.count}`);
  record("creative advisor version", Boolean(s.creativeAdvisor?.version), s.creativeAdvisor?.version ?? "");

  const advisor = await json("POST", "/api/ai-director/creative-advisor/analyze", {
    projectId: `live-ollama-${Date.now()}`,
    productName: "KWIZERA Test Shoe",
    productCategory: "Fashion footwear",
    brandName: "KWIZERA",
    targetAudience: "Young professionals",
    marketingObjective: "Short social product video",
    imageRoles: ["HERO", "DETAIL", "PACKAGING"],
    bpm: 118,
    energy: "high",
    creativeMode: "energetic",
  }, 180000);

  const result = advisor.data?.result;
  record("advisor analyze HTTP", advisor.ok, `status=${advisor.status}`);
  record("advisor structured fields", Boolean(result?.recommendedSceneStructure?.length), JSON.stringify({
    source: result?.source,
    confidence: result?.confidence,
    structure: result?.recommendedSceneStructure,
    transitions: result?.recommendedTransitions,
    limitations: result?.limitations?.slice(0, 2),
    latencyMs: result?.latencyMs,
    model: result?.model,
  }));
  record(
    "transitions cut/fade only",
    Array.isArray(result?.recommendedTransitions)
      && result.recommendedTransitions.every((t) => t === "cut" || t === "fade"),
    String(result?.recommendedTransitions),
  );
  record(
    "multimodal honesty",
    Array.isArray(result?.limitations)
      && result.limitations.some((l) => /cannot see|do not see|text-only|pixels/i.test(l)),
    result?.limitations?.[0] ?? "",
  );

  // Public surface must not proxy raw Ollama.
  const leak = await json("GET", "/api/ollama/tags", null, 10000).catch(() => ({ ok: false, status: 0 }));
  record("ollama not publicly exposed via /api/ollama/tags", leak.status === 404 || !leak.ok, `status=${leak.status}`);

  const report = {
    base: BASE,
    at: new Date().toISOString(),
    checks,
    status: s,
    advisor: result ?? null,
    passed: checks.filter((c) => c.ok).length,
    total: checks.length,
  };
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n${report.passed}/${report.total} checks passed`);
  console.log(`Wrote ${join(outDir, "report.json")}`);
  if (report.passed < report.total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
