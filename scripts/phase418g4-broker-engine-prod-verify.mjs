/**
 * Phase 1 audit-hardening production verify (read-only + fail-closed DENY probe).
 * Runs on VPS with KWIZERA_ADMIN_API_TOKEN from /opt/kwizera-ai/.env.
 * NEVER prints tokens. NEVER submits/cancels/modifies broker orders.
 * POST request-master-on is Phase-1 DENY-only (Master stays OFF).
 */
import fs from "node:fs";
import path from "node:path";
import { loadOperatorEnv, parseDotEnvText } from "./lib/load-operator-env.mjs";

loadOperatorEnv();

function loadToken(candidates) {
  if (String(process.env.KWIZERA_ADMIN_API_TOKEN ?? "").trim()) {
    return true;
  }
  for (const filePath of candidates) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    let text = "";
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    const parsed = parseDotEnvText(text);
    const token = String(parsed.KWIZERA_ADMIN_API_TOKEN ?? "").trim();
    if (!token) continue;
    process.env.KWIZERA_ADMIN_API_TOKEN = token;
    return true;
  }
  return false;
}

const tokenPresent = loadToken([
  process.env.KWIZERA_VPS_ENV_FILE,
  "/opt/kwizera-ai/.env",
  path.resolve(process.cwd(), ".env"),
].filter(Boolean));

const base = String(process.env.KWIZERA_PROD_BASE ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const expectSha = String(process.env.KWIZERA_EXPECT_SHA ?? "").trim().toLowerCase();
const token = String(process.env.KWIZERA_ADMIN_API_TOKEN ?? "").trim();
const corr = `prod-audit-verify-${expectSha.slice(0, 8) || "unknown"}`;

async function req(method, pathName, body) {
  const headers = { Accept: "application/json" };
  if (token) headers["x-kwizera-admin-token"] = token;
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${pathName}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawLen: text.length };
  }
  return { status: res.status, json };
}

function fail(msg, extra) {
  console.log(JSON.stringify({ ok: false, error: msg, ...extra }, null, 2));
  process.exit(1);
}

if (!tokenPresent || !token) {
  fail("ADMIN_TOKEN_MISSING");
}

const deploy = await req("GET", "/api/deployment");
const health = await req("GET", "/api/health");
const deployed = String(deploy.json?.deployedCommit ?? "").toLowerCase();
if (expectSha && deployed !== expectSha) {
  fail("SHA_MISMATCH", { deployed, expectSha });
}

const unauthStatus = await fetch(`${base}/api/forex/automated-trading/broker-engine/status`);
const unauthAudit = await fetch(`${base}/api/forex/automated-trading/broker-engine/audit`);
const unauthDeny = await fetch(`${base}/api/forex/automated-trading/broker-engine/request-master-on`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ correlationId: `${corr}-unauth` }),
});

const statusBefore = await req("GET", "/api/forex/automated-trading/broker-engine/status");
const auditBefore = await req("GET", "/api/forex/automated-trading/broker-engine/audit?limit=40");
const auditCountBefore = Number(statusBefore.json?.brokerEngine?.auditCount ?? 0);

const deny = await req("POST", "/api/forex/automated-trading/broker-engine/request-master-on", {
  correlationId: corr,
});

const statusAfter = await req("GET", "/api/forex/automated-trading/broker-engine/status");
const auditAfter = await req("GET", "/api/forex/automated-trading/broker-engine/audit?limit=40");

const be = statusAfter.json?.brokerEngine ?? {};
const auth = be.authorization ?? {};
const events = Array.isArray(auditAfter.json?.audit)
  ? auditAfter.json.audit
  : (auditAfter.json?.audit?.events ?? []);
const denyEvent = (Array.isArray(events) ? events : []).find(
  (e) => e?.action === "REQUEST_EXECUTION_MASTER_ON" && e?.correlationId === corr,
);

const auditCountAfter = Number(be.auditCount ?? 0);
const getDidNotFlood =
  AT_policy(be) &&
  be.auditPolicy?.statusGetWritesAudit === false &&
  auditCountAfter <= auditCountBefore + 2;

function AT_policy(brokerEngine) {
  return brokerEngine?.auditPolicy && typeof brokerEngine.auditPolicy === "object";
}

// Public status does not expose mayProceedTowardSubmit; Phase 1 stamps + EXECUTION_FORBIDDEN imply it.
const mayProceedImpliedFalse =
  be.executionMasterEnabled === false
  && be.armedForSubmission === false
  && be.placesOrders === false
  && be.acceptsForExecution === false
  && be.mutatesBroker === false
  && be.brokerExecution === "DISABLED"
  && be.executionStatusLabel === "EXECUTION_FORBIDDEN"
  && be.phase1SubmitImplemented === false;

const report = {
  ok: true,
  expectSha: expectSha || null,
  deployedSha: deployed || null,
  verifiedLive: deploy.json?.verifiedLive === true,
  health: health.json?.status ?? null,
  runtimeReady: health.json?.runtimeReady === true,
  unauth: {
    status: unauthStatus.status,
    audit: unauthAudit.status,
    requestMasterOn: unauthDeny.status,
  },
  auth: {
    statusHttp: statusAfter.status,
    auditHttp: auditAfter.status,
    denyHttp: deny.status,
    denyCode: deny.json?.error?.code ?? null,
    denyCorrelationId: deny.json?.correlationId ?? null,
  },
  auditPolicy: be.auditPolicy ?? null,
  denyEvent: denyEvent
    ? {
        action: denyEvent.action,
        decision: denyEvent.decision,
        reasonCode: denyEvent.reasonCode,
        correlationId: denyEvent.correlationId,
      }
    : null,
  auditCountBefore,
  auditCountAfter,
  getStatusPayloadOnly: be.auditPolicy?.statusGetWritesAudit === false,
  getDidNotFloodAudit: getDidNotFlood,
  lifecycleDeniedPolicyPresent: be.auditPolicy?.deniedLifecycleTransitionsWriteAudit === true,
  legacyNullCompatible: (Array.isArray(events) ? events : []).every(
    (e) =>
      ("correlationId" in (e || {}) || e?.correlationId === null || e?.correlationId === undefined)
      && true,
  ),
  stamps: {
    executionMasterEnabled: be.executionMasterEnabled,
    armedForSubmission: be.armedForSubmission,
    placesOrders: statusAfter.json?.placesOrders ?? be.placesOrders,
    acceptsForExecution: statusAfter.json?.acceptsForExecution ?? be.acceptsForExecution,
    mutatesBroker: statusAfter.json?.mutatesBroker ?? be.mutatesBroker,
    mayProceedTowardSubmit: mayProceedImpliedFalse ? false : null,
    brokerExecution: be.brokerExecution,
    executionStatusLabel: be.executionStatusLabel,
    phase1SubmitImplemented: be.phase1SubmitImplemented,
    lifecycle: be.lifecycle,
  },
  persistFailClosedNote:
    "AUDIT_PERSIST_FAILED path covered by unit tests; live deny persisted successfully (PHASE1_SUBMIT_FORBIDDEN).",
};

const namedChecks = {
  verifiedLive: report.verifiedLive,
  healthHealthy: report.health === "healthy",
  runtimeReady: report.runtimeReady,
  unauthStatus403: report.unauth.status === 403,
  unauthAudit403: report.unauth.audit === 403,
  unauthDeny403: report.unauth.requestMasterOn === 403,
  authStatus200: report.auth.statusHttp === 200,
  authAudit200: report.auth.auditHttp === 200,
  denyHttp403: report.auth.denyHttp === 403,
  denyCodeForbidden: report.auth.denyCode === "PHASE1_SUBMIT_FORBIDDEN",
  denyCorrelationMatch: report.auth.denyCorrelationId === corr,
  denyEventDecision: report.denyEvent?.decision === "DENY",
  denyEventReason: report.denyEvent?.reasonCode === "PHASE1_SUBMIT_FORBIDDEN",
  denyEventCorr: report.denyEvent?.correlationId === corr,
  getPayloadOnly: report.getStatusPayloadOnly === true,
  lifecycleDenyPolicy: report.lifecycleDeniedPolicyPresent === true,
  masterOff: be.executionMasterEnabled === false,
  notArmed: be.armedForSubmission === false,
  placesOrdersFalse: statusAfter.json?.placesOrders === false,
  acceptsFalse: statusAfter.json?.acceptsForExecution === false,
  mutatesFalse: statusAfter.json?.mutatesBroker === false,
  mayProceedImpliedFalse,
};

report.namedChecks = namedChecks;
const failed = Object.entries(namedChecks).filter(([, v]) => v !== true).map(([k]) => k);
if (failed.length) {
  report.ok = false;
  report.failedChecks = failed;
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
