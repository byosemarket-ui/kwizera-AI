import fs from "node:fs";
import path from "node:path";
import { BLUEPRINT_STEPS, PHASE_DEFINITIONS } from "./phase-definitions.js";
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
let registryCache = null;
function readPackageJson() {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
    return pkg.scripts ?? {};
}
function extractStepFromScript(scriptPath) {
    const fullPath = path.join(PROJECT_ROOT, scriptPath.replace(/^tsx\s+/, ""));
    if (!fs.existsSync(fullPath))
        return null;
    const content = fs.readFileSync(fullPath, "utf8");
    const validationMatch = content.match(/Step\s+(\d+)([A-Z])\s+(?:[—–-]\s+)?(.+?)\s+Engine\s+Validation/i) ?? content.match(/Step\s+(\d+)([A-Z])\s+(?:[—–-]\s+)?(.+?)\s+Validation/i);
    if (validationMatch) {
        const phase = Number(validationMatch[1]);
        return {
            step: `${validationMatch[1]}${validationMatch[2]}`,
            phase,
            name: validationMatch[3].trim(),
        };
    }
    const certMatch = content.match(/Phase\s+(\d+)\s+Step\s+(\d+)([A-Z])\s+(.+?)\s+Certification/i) ?? content.match(/Phase\s+(\d+)\s+Step\s+(\d+)([A-Z])/i);
    if (certMatch) {
        const name = certMatch[4]?.trim() ?? "Certification";
        return {
            step: `${certMatch[2]}${certMatch[3]}`,
            phase: Number(certMatch[1]),
            name,
        };
    }
    return null;
}
function resolveAiPath(validateKey) {
    const candidates = [
        validateKey,
        `${validateKey}-engine`,
        validateKey.replace(/-engine$/, ""),
    ];
    for (const candidate of candidates) {
        const aiIndex = path.join(PROJECT_ROOT, "ai", candidate, "index.ts");
        if (fs.existsSync(aiIndex)) {
            return `ai/${candidate}`;
        }
    }
    const aiDirs = fs.readdirSync(path.join(PROJECT_ROOT, "ai"), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    const normalized = validateKey.replace(/-engine$/, "");
    const fuzzy = aiDirs.find((d) => d === validateKey || d === `${validateKey}-engine` || d.replace(/-engine$/, "") === normalized);
    return fuzzy ? `ai/${fuzzy}` : null;
}
function parseValidationReport(step) {
    const reportFile = `STEP-${step}-VALIDATION-REPORT.md`;
    const reportPath = path.join(PROJECT_ROOT, reportFile);
    if (!fs.existsSync(reportPath)) {
        const certFile = `STEP-${step}-CERTIFICATION-REPORT.md`;
        const certPath = path.join(PROJECT_ROOT, certFile);
        if (!fs.existsSync(certPath)) {
            return { status: "not-run", readinessScore: null, lastValidated: null, reportFile: null };
        }
        return parseReportContent(fs.readFileSync(certPath, "utf8"), certFile);
    }
    return parseReportContent(fs.readFileSync(reportPath, "utf8"), reportFile);
}
function parseReportContent(content, reportFile) {
    const passMatch = content.match(/\*\*Overall:\*\*\s*(✅\s*PASS|PASS|✅)/i) ??
        content.match(/\|\s*\*\*Overall\*\*\s*\|\s*(✅\s*PASS|PASS|✅)/i) ??
        content.match(/^-\s*Overall:\s*✅\s*PASS/im) ??
        content.match(/APPROVED\s*[—–-]\s*COMPLETE/i) ??
        content.match(/\|\s*\*\*Phase\s+\d+\s+Status\*\*\s*\|\s*✅/i);
    const failMatch = content.match(/\*\*Overall:\*\*\s*(❌\s*FAIL|FAIL|❌)/i) ??
        content.match(/\|\s*\*\*Overall\*\*\s*\|\s*(❌\s*FAIL|FAIL|❌)/i);
    let status = "unknown";
    if (passMatch)
        status = "pass";
    else if (failMatch)
        status = "fail";
    const readinessMatch = content.match(/Readiness(?:\s+Score)?:\s*\*?\*?(\d+)\/100/i) ??
        content.match(/\*\*Readiness Score\*\*\s*\|\s*\*\*(\d+)\/100\*\*/i) ??
        content.match(/\*\*Overall Engineering Score\*\*\s*\|\s*\*\*(\d+)\/100\*\*/i);
    const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/i);
    return {
        status,
        readinessScore: readinessMatch ? Number(readinessMatch[1]) : null,
        lastValidated: dateMatch ? dateMatch[1].trim() : null,
        reportFile,
    };
}
function stepWithinLimit(step, maxStep) {
    const parse = (s) => {
        const m = s.match(/^(\d+)([A-Z])$/);
        if (!m)
            return null;
        return { phase: Number(m[1]), letter: m[2].charCodeAt(0) };
    };
    const a = parse(step);
    const b = parse(maxStep);
    if (!a || !b)
        return true;
    if (a.phase !== b.phase)
        return a.phase < b.phase;
    return a.letter <= b.letter;
}
function buildBlueprintModules() {
    return BLUEPRINT_STEPS.map((bp) => {
        const exists = fs.existsSync(path.join(PROJECT_ROOT, bp.file));
        return {
            id: `blueprint-${bp.step.toLowerCase()}`,
            step: bp.step,
            phase: 1,
            name: bp.name,
            engine: "Blueprint",
            aiPath: null,
            validateKey: null,
            status: exists ? "blueprint" : "fail",
            readinessScore: exists ? 100 : 0,
            reportFile: bp.file,
            lastValidated: null,
            kind: "blueprint",
        };
    });
}
function buildImplementationModules() {
    const scripts = readPackageJson();
    const modules = [];
    for (const [key, command] of Object.entries(scripts)) {
        if (!key.startsWith("validate:") || key === "validate:phase2" || key === "validate:phase3" ||
            key === "validate:phase4" || key === "validate:phase5" || key === "validate:phase6" ||
            key === "validate:phase9") {
            continue;
        }
        const validateKey = key.replace("validate:", "");
        const isCert = validateKey.endsWith("-certification");
        const meta = extractStepFromScript(command);
        if (!meta)
            continue;
        const phaseDef = PHASE_DEFINITIONS.find((p) => p.phase === meta.phase);
        if (!phaseDef)
            continue;
        if (!stepWithinLimit(meta.step, phaseDef.maxStep) && !isCert)
            continue;
        const report = parseValidationReport(meta.step);
        const aiPath = isCert ? null : resolveAiPath(validateKey);
        modules.push({
            id: validateKey,
            step: meta.step,
            phase: meta.phase,
            name: meta.name,
            engine: phaseDef.engine,
            aiPath,
            validateKey,
            status: report.status,
            readinessScore: report.readinessScore,
            reportFile: report.reportFile,
            lastValidated: report.lastValidated,
            kind: isCert ? "certification" : "module",
        });
    }
    return modules.sort((a, b) => {
        if (a.phase !== b.phase)
            return a.phase - b.phase;
        return a.step.localeCompare(b.step);
    });
}
export function buildRegistry(forceRefresh = false) {
    if (registryCache && !forceRefresh)
        return registryCache;
    const blueprintModules = buildBlueprintModules();
    const implModules = buildImplementationModules();
    const result = PHASE_DEFINITIONS.map((phaseDef) => {
        const modules = phaseDef.phase === 1
            ? blueprintModules
            : implModules.filter((m) => m.phase === phaseDef.phase);
        const passed = modules.filter((m) => m.status === "pass" || m.status === "blueprint").length;
        let status = "unknown";
        if (modules.length === 0)
            status = "not-run";
        else if (passed === modules.length)
            status = "pass";
        else if (modules.some((m) => m.status === "fail"))
            status = "fail";
        else if (modules.some((m) => m.status === "pass" || m.status === "blueprint"))
            status = "unknown";
        return {
            phase: phaseDef.phase,
            id: phaseDef.id,
            name: phaseDef.name,
            engine: phaseDef.engine,
            description: phaseDef.description,
            maxStep: phaseDef.maxStep,
            modules,
            totalModules: modules.length,
            passedModules: passed,
            status,
        };
    });
    registryCache = result;
    return result;
}
export function invalidateRegistryCache() {
    registryCache = null;
}
export function findModule(validateKey) {
    const all = buildRegistry().flatMap((p) => p.modules);
    return all.find((m) => m.validateKey === validateKey || m.id === validateKey);
}
export function listAiModules() {
    return fs
        .readdirSync(path.join(PROJECT_ROOT, "ai"), { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(PROJECT_ROOT, "ai", d.name, "index.ts")))
        .map((d) => d.name)
        .sort();
}
export function getProjectRoot() {
    return PROJECT_ROOT;
}
//# sourceMappingURL=module-registry.js.map