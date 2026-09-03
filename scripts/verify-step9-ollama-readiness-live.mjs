#!/usr/bin/env node
/**
 * Live Step 9 verification — Ollama readiness while Ollama is still NOT installed.
 * Does not install Ollama or download models.
 */
const BASE = (process.argv[2] ?? "http://162.35.114.19:5173").replace(/\/$/, "");
const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function json(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log(`Live Step 9 Ollama readiness — ${BASE}`);

  const deployment = await json("/api/deployment");
  record("deployment live", deployment.ok && deployment.body?.status === "live", deployment.body?.deployedCommit?.slice(0, 12) ?? "");

  const health = await json("/api/health");
  record("health", health.ok, health.body?.status ?? String(health.status));

  const foundation = await json("/api/foundation-health");
  record("foundation health", foundation.ok, JSON.stringify(foundation.body?.checks?.map?.((c) => c.name) ?? foundation.body?.ok ?? ""));

  const readiness = await json("/api/media-intelligence/ollama-readiness");
  const r = readiness.body?.readiness ?? readiness.body;
  record("ollama readiness endpoint", readiness.ok, r?.installationStatus ?? r?.status ?? "");
  record("auto install disabled", r?.autoInstallDisabled === true, "");
  record("fallback active while ollama absent", r?.fallbackActive === true || r?.ready === false, `ready=${r?.ready}`);
  record("public readiness hides base URL", !JSON.stringify(r ?? {}).includes("127.0.0.1"), "");
  record("public readiness hides RAM figures", !/\b\d+(\.\d+)?\b/.test(JSON.stringify(r?.totalMemoryGb ?? "")) && !JSON.stringify(r ?? {}).includes("totalMemoryGb"), "");

  const status = await json("/api/creative-director/status");
  record("creative director status", status.ok, status.body?.creativeDirector?.mode ?? "");
  record(
    "deterministic fallback while ollama absent",
    status.body?.creativeDirector?.mode === "deterministic-fallback"
      || status.body?.creativeDirector?.available === false,
    status.body?.creativeDirector?.mode ?? "",
  );
  record("pipeline forbids install now", status.body?.pipeline?.installOllamaNow === false, "");
  record("pipeline forbids auto download", status.body?.pipeline?.autoDownloadModels === false, "");

  const diagnostics = await json("/api/ai-director/diagnostics");
  record("ai director diagnostics", diagnostics.ok, diagnostics.body?.diagnostics?.ollama?.installationStatus
    ?? diagnostics.body?.ollama?.installationStatus
    ?? diagnostics.body?.diagnostics?.ollama?.status
    ?? "");
  const diag = diagnostics.body?.diagnostics ?? diagnostics.body;
  record("diagnostics hide private base URL", !JSON.stringify(diag ?? {}).includes("http://127.0.0.1"), "");
  record("diagnostics auto install disabled", diag?.ollama?.autoInstallDisabled === true, "");
  // While Ollama is not installed, READY must not be claimed.
  record(
    "not reporting READY without ollama",
    diag?.ollama?.status !== "READY",
    String(diag?.ollama?.status ?? ""),
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} Step 9 live checks passed`);
  for (const item of failed) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
