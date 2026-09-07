/**
 * Live proof: Intelligence Layer Memory→Knowledge→Learning→Skills→Decision
 * + optional Ollama decide + second-pass learning retrieval.
 * Does NOT wipe Memory/Knowledge. Does NOT expose Ollama publicly.
 */
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.KWIZERA_LIVE_BASE || "http://162.35.114.19:5173";
const OUT = path.resolve("intelligence-layer-artifacts");

async function json(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    base: BASE,
    steps: [],
    complete: false,
  };

  const health = await json(`${BASE}/api/health`);
  report.steps.push({ name: "health", ...health });

  const status = await json(`${BASE}/api/intelligence-layer/status`);
  report.steps.push({ name: "intel-status", ...status });

  const projectId = `intel-proof-${Date.now().toString(36)}`;

  // Decision without prior learning (deterministic path).
  const decide1 = await json(`${BASE}/api/intelligence-layer/decide`, {
    method: "POST",
    body: JSON.stringify({
      projectId,
      productName: "Kwizera Proof Perfume",
      category: "beauty",
      audience: "social shoppers",
      durationSeconds: 20,
      cta: "Shop now",
      platform: "tiktok",
      imageRoles: ["HERO", "DETAIL", "CTA"],
      useOllama: false,
    }),
  });
  report.steps.push({ name: "decide-deterministic", ...decide1 });

  // Optional Ollama-assisted decision (may fallback).
  const decideAi = await json(`${BASE}/api/intelligence-layer/decide`, {
    method: "POST",
    body: JSON.stringify({
      projectId,
      productName: "Kwizera Proof Perfume",
      category: "beauty",
      durationSeconds: 20,
      cta: "Shop now",
      platform: "tiktok",
      imageRoles: ["HERO", "DETAIL"],
      useOllama: true,
    }),
  });
  report.steps.push({ name: "decide-ollama", ...decideAi });

  // Strong learning event → possible promotion.
  const learn = await json(`${BASE}/api/intelligence-layer/record-learning`, {
    method: "POST",
    body: JSON.stringify({
      projectId,
      forceStrong: true,
      qualityScore: 88,
      planSource: "ai",
      aiModelId: "llama3.2:1b",
      scenePurposes: ["HOOK", "REVEAL", "FEATURE", "CTA"],
      renderSucceeded: true,
    }),
  });
  report.steps.push({ name: "record-learning", ...learn });

  // Weak learning must refuse promotion path (separate project).
  const weak = await json(`${BASE}/api/intelligence-layer/record-learning`, {
    method: "POST",
    body: JSON.stringify({
      projectId: `${projectId}-weak`,
      qualityScore: 71,
      planSource: "ai",
      scenePurposes: ["HOOK", "CTA"],
      renderSucceeded: true,
      forceStrong: false,
    }),
  });
  report.steps.push({ name: "record-learning-weak", ...weak });

  const learningGet = await json(`${BASE}/api/intelligence-layer/projects/${encodeURIComponent(projectId)}/learning`);
  report.steps.push({ name: "get-learning", ...learningGet });

  const patterns = await json(`${BASE}/api/intelligence-layer/knowledge-patterns`);
  report.steps.push({ name: "knowledge-patterns", ...patterns });

  const second = await json(`${BASE}/api/intelligence-layer/second-pass`, {
    method: "POST",
    body: JSON.stringify({
      projectId: `${projectId}-pass2`,
      productName: "Kwizera Proof Perfume",
      category: "beauty",
      imageRoles: ["HERO", "DETAIL", "CTA"],
      useOllama: false,
    }),
  });
  report.steps.push({ name: "second-pass", ...second });

  const promoted = Boolean(learn.body?.promoted?.length);
  const refusedWeak = Array.isArray(weak.body?.refused) && weak.body.refused.length > 0
    && (!weak.body.promoted || weak.body.promoted.length === 0);
  const secondInfluenced = Boolean(second.body?.learningInfluenced)
    || Boolean(second.body?.decision?.knowledgePatternIds?.length);
  const decisionOk = Boolean(decide1.body?.decision?.decisionId);
  const layerReady = Boolean(status.body?.status?.ready);

  report.complete = layerReady && decisionOk && Boolean(learn.body?.event)
    && (promoted ? secondInfluenced : true)
    && refusedWeak;
  report.summary = {
    layerReady,
    decisionOk,
    learningEventId: learn.body?.event?.eventId ?? null,
    promoted,
    promotionRefusedForWeak: refusedWeak,
    secondPassLearningInfluenced: secondInfluenced,
    ollamaDecisionSource: decideAi.body?.decision?.reasoningSource ?? null,
    ollamaModel: decideAi.body?.decision?.model ?? null,
    classification: {
      strongPromotion: promoted ? "FIXED_OR_WORKING" : "FALLBACK_OR_INSUFFICIENT_EVIDENCE",
      weakRefusal: refusedWeak ? "CORRECT_REFUSAL" : "UNEXPECTED",
      ollama: decideAi.body?.decision?.reasoningSource === "ai"
        ? "OLLAMA_ASSISTED"
        : "DETERMINISTIC_FALLBACK",
    },
  };
  report.finishedAt = new Date().toISOString();

  await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  if (!report.complete) {
    console.error("INTELLIGENCE_LAYER_PROOF_INCOMPLETE");
    process.exitCode = 1;
  } else {
    console.log("INTELLIGENCE_LAYER_PROOF_OK");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
