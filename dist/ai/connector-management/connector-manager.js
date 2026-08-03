import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { AiSecretsManager } from "./secrets-manager.js";
import { AUTHENTICATION_TYPES, CONNECTOR_CATEGORIES } from "./types.js";
const healthy = () => ({ available: false, authenticated: false, responseTimeMs: 0, executionCount: 0, failureCount: 0, errorRate: 0, stability: "healthy", lastCheckedAt: new Date().toISOString() });
const defaultTransport = async (request) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
        const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body, redirect: "error", signal: controller.signal });
        const text = await response.text();
        let body = text;
        try {
            body = text ? JSON.parse(text) : {};
        }
        catch { /* Non-JSON API responses are returned as text. */ }
        return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body };
    }
    finally {
        clearTimeout(timer);
    }
};
/** Central local-first registry and secure executor for approved external service connectors. */
export class AiConnectorManager {
    transport;
    secrets = new AiSecretsManager();
    root = "";
    core = null;
    tools = null;
    initialized = false;
    connectors = new Map();
    logs = [];
    constructor(transport = defaultTransport) {
        this.transport = transport;
    }
    async initialize(core, tools, storageRoot, secretsPassphrase) { this.root = path.join(storageRoot, "connector-management"); this.core = core; this.tools = tools; await fs.mkdir(this.root, { recursive: true }); await this.secrets.initialize(storageRoot, secretsPassphrase); await this.restore(); this.initialized = true; }
    isInitialized() { return this.initialized; }
    list(category) { return [...this.connectors.values()].filter((connector) => connector.status !== "removed" && (!category || connector.category === category)).map((connector) => structuredClone(connector)); }
    get(connectorId) { const connector = this.connectors.get(connectorId); return connector && connector.status !== "removed" ? structuredClone(connector) : null; }
    getLogs() { return this.logs; }
    async register(definition) { this.ensureReady(); this.validateDefinition(definition); if (this.connectors.has(definition.id) && this.connectors.get(definition.id).status !== "removed")
        throw new Error(`Connector already registered: ${definition.id}`); const now = new Date().toISOString(); const connector = { ...definition, status: "registered", health: healthy(), profiles: {}, registeredAt: now, updatedAt: now }; this.connectors.set(connector.id, connector); await this.log("registration", connector.id, `Registered ${connector.name} v${connector.version}`); await this.persist(); return structuredClone(connector); }
    async discover(definitions) { let count = 0; for (const definition of definitions)
        if (!this.connectors.has(definition.id)) {
            await this.register(definition);
            count++;
        } return count; }
    async enable(connectorId) { const connector = this.require(connectorId); this.validateConnector(connector); connector.status = "enabled"; connector.updatedAt = new Date().toISOString(); await this.log("enabled", connectorId, "Connector enabled"); await this.persist(); }
    async disable(connectorId) { const connector = this.require(connectorId); connector.status = "disabled"; connector.updatedAt = new Date().toISOString(); await this.log("disabled", connectorId, "Connector disabled"); await this.persist(); }
    async remove(connectorId) { const connector = this.require(connectorId); connector.status = "removed"; connector.updatedAt = new Date().toISOString(); await this.log("removed", connectorId, "Connector removed; encrypted secret retained until explicitly deleted"); await this.persist(); }
    async update(connectorId, changes) { const connector = this.require(connectorId); const candidate = { ...connector, ...changes }; this.validateDefinition(candidate); Object.assign(connector, changes, { updatedAt: new Date().toISOString() }); await this.log("update", connectorId, "Connector configuration updated"); await this.persist(); return structuredClone(connector); }
    async configureProfile(connectorId, profile, configuration) { const connector = this.require(connectorId); connector.profiles[profile] = structuredClone(configuration); connector.updatedAt = new Date().toISOString(); await this.log("profile", connectorId, `Configured ${profile} profile`); await this.persist(); return structuredClone(connector); }
    validate(connectorId) { try {
        this.validateConnector(this.require(connectorId));
        return { valid: true, errors: [] };
    }
    catch (error) {
        return { valid: false, errors: [error instanceof Error ? error.message : String(error)] };
    } }
    async execute(request) { return this.executeInternal(request, new Set()); }
    async monitor(connectorId) { const targets = connectorId ? [this.require(connectorId)] : this.list().map((connector) => this.require(connector.id)); for (const connector of targets) {
        connector.health.available = connector.status === "enabled";
        connector.health.authenticated = !connector.authentication.secretId || (this.secrets.isUnlocked() && this.secrets.has(connector.authentication.secretId));
        connector.health.lastCheckedAt = new Date().toISOString();
    } await this.persist(); return Object.fromEntries(targets.map((connector) => [connector.id, structuredClone(connector.health)])); }
    getIntegrationStatus() { return { aiCore: Boolean(this.core), toolRegistry: Boolean(this.tools), toolManager: Boolean(this.tools), pluginManager: Boolean(this.core?.pluginManager), workflowEngine: Boolean(this.core?.workflowEngine), automationEngine: Boolean(this.core?.workflowEngine), communicationBus: Boolean(this.core?.communicationBus), taskScheduler: Boolean(this.core?.taskManager), multiAgentSystem: false }; }
    async executeInternal(request, visited) {
        const started = performance.now();
        let attempts = 0;
        let connector;
        try {
            connector = this.require(request.connectorId);
            if (connector.status !== "enabled")
                throw new Error("Connector is not enabled");
            if (visited.has(connector.id))
                throw new Error("Connector fallback cycle detected");
            visited.add(connector.id);
            this.validatePermissions(connector, request.permissions);
            const resolved = this.resolveProfile(connector, request.profile);
            this.validateDefinition(resolved);
            this.validateRequest(resolved, request);
            const headers = this.headers(resolved, request.headers);
            const url = new URL(request.path, resolved.endpoint.baseUrl).toString();
            let response;
            let lastError;
            for (let attempt = 1; attempt <= resolved.retryPolicy.maxAttempts; attempt++) {
                attempts = attempt;
                try {
                    response = await this.transport({ url, method: request.method ?? "GET", headers, body: request.body === undefined ? undefined : JSON.stringify(request.body), timeoutMs: resolved.timeoutMs });
                    if (response.status >= 200 && response.status < 300) {
                        this.record(connector, started, true);
                        await this.log("api-call", connector.id, `${request.method ?? "GET"} ${request.path} succeeded`);
                        await this.persist();
                        return { connectorId: connector.id, status: "succeeded", statusCode: response.status, data: response.body, attempts, durationMs: Math.round(performance.now() - started) };
                    }
                    lastError = `Remote service returned HTTP ${response.status}`;
                    if (!resolved.retryPolicy.retryStatusCodes.includes(response.status))
                        break;
                    await this.delay(this.retryDelay(resolved.retryPolicy, response.headers, attempt));
                }
                catch (error) {
                    lastError = error instanceof Error ? error.message : String(error);
                    if (attempt < resolved.retryPolicy.maxAttempts)
                        await this.delay(this.retryDelay(resolved.retryPolicy, {}, attempt));
                }
            }
            throw new Error(lastError ?? "Connector request failed");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (connector) {
                connector.lastError = message;
                this.record(connector, started, false);
                await this.log("error", connector.id, message);
                await this.persist();
                if (connector.fallbackConnectorId && !visited.has(connector.fallbackConnectorId)) {
                    await this.log("fallback", connector.id, `Trying backup connector ${connector.fallbackConnectorId}`);
                    const fallback = await this.executeInternal({ ...request, connectorId: connector.fallbackConnectorId }, visited);
                    if (fallback.status === "succeeded" || fallback.status === "fallback-succeeded")
                        return { ...fallback, status: "fallback-succeeded", fallbackConnectorId: fallback.connectorId };
                }
            }
            return { connectorId: request.connectorId, status: "failed", error: message, attempts, durationMs: Math.round(performance.now() - started) };
        }
    }
    resolveProfile(connector, profile) { return profile && connector.profiles[profile] ? { ...connector, ...connector.profiles[profile], endpoint: { ...connector.endpoint, ...connector.profiles[profile]?.endpoint }, authentication: { ...connector.authentication, ...connector.profiles[profile]?.authentication }, retryPolicy: { ...connector.retryPolicy, ...connector.profiles[profile]?.retryPolicy } } : connector; }
    headers(connector, requestHeaders) { const headers = { ...(connector.endpoint.headers ?? {}), ...(requestHeaders ?? {}) }; if (Object.keys(headers).some((key) => ["authorization", "host", "proxy-authorization"].includes(key.toLowerCase())))
        throw new Error("Sensitive transport headers are managed by the connector"); if (connector.authentication.secretId) {
        const secret = this.secrets.get(connector.authentication.secretId);
        if (connector.authentication.type === "api-key")
            headers[connector.authentication.headerName ?? "X-API-Key"] = secret;
        else if (connector.authentication.type === "custom")
            headers[connector.authentication.headerName ?? "Authorization"] = secret;
        else
            headers.Authorization = `${connector.authentication.tokenPrefix ?? "Bearer"} ${secret}`;
    } return headers; }
    validateRequest(connector, request) { if (!request.path.startsWith("/") || request.path.startsWith("//"))
        throw new Error("Connector path must be an absolute relative path"); if (connector.endpoint.allowedPaths?.length && !connector.endpoint.allowedPaths.some((prefix) => request.path.startsWith(prefix)))
        throw new Error("Connector path is not permitted"); }
    validateConnector(connector) { this.validateDefinition(connector); if (connector.fallbackConnectorId === connector.id)
        throw new Error("Connector cannot fall back to itself"); }
    validateDefinition(connector) { if (!/^[a-z0-9][a-z0-9.-]{2,100}$/i.test(connector.id))
        throw new Error("Connector id is invalid"); if (!connector.name.trim() || !connector.description.trim() || !connector.provider.trim())
        throw new Error("Connector name, description, and provider are required"); if (!CONNECTOR_CATEGORIES.includes(connector.category))
        throw new Error("Connector category is invalid"); if (!AUTHENTICATION_TYPES.includes(connector.authentication.type))
        throw new Error("Connector authentication type is invalid"); if (!/^\d+\.\d+\.\d+$/.test(connector.version))
        throw new Error("Connector version must be semantic"); const endpoint = new URL(connector.endpoint.baseUrl); const local = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1" || endpoint.hostname === "::1"; if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
        throw new Error("Connector endpoint cannot contain credentials, query parameters, or fragments"); if (endpoint.protocol !== "https:" && !(local && connector.endpoint.allowInsecureLocalhost && endpoint.protocol === "http:"))
        throw new Error("Connector endpoint must use HTTPS; HTTP is allowed only for explicit localhost development connectors"); if (!Number.isInteger(connector.timeoutMs) || connector.timeoutMs < 100 || connector.timeoutMs > 120000)
        throw new Error("Connector timeout must be between 100ms and 120000ms"); const policy = connector.retryPolicy; if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 5 || policy.initialDelayMs < 0 || policy.maxDelayMs < policy.initialDelayMs)
        throw new Error("Connector retry policy is invalid"); }
    validatePermissions(connector, permissions) { const granted = new Set(permissions ?? []); if (connector.requiredPermissions.some((permission) => !granted.has(permission)))
        throw new Error("Required connector permission was not granted"); }
    record(connector, started, success) { connector.health.executionCount++; if (!success)
        connector.health.failureCount++; connector.health.responseTimeMs = Math.round(performance.now() - started); connector.health.errorRate = Math.round(connector.health.failureCount / connector.health.executionCount * 100); connector.health.stability = connector.health.errorRate >= 50 ? "unhealthy" : connector.health.errorRate ? "degraded" : "healthy"; connector.health.lastCheckedAt = new Date().toISOString(); }
    retryDelay(policy, headers, attempt) { const retryAfter = Number(headers["retry-after"]); if (Number.isFinite(retryAfter) && retryAfter >= 0)
        return Math.min(retryAfter * 1000, policy.maxDelayMs); return Math.min(policy.initialDelayMs * 2 ** (attempt - 1), policy.maxDelayMs); }
    async delay(milliseconds) { if (milliseconds > 0)
        await new Promise((resolve) => setTimeout(resolve, milliseconds)); }
    require(connectorId) { this.ensureReady(); const connector = this.connectors.get(connectorId); if (!connector || connector.status === "removed")
        throw new Error(`Connector not found: ${connectorId}`); return connector; }
    ensureReady() { if (!this.initialized || !this.tools)
        throw new Error("Connector Manager is not initialized"); }
    async log(event, connectorId, detail) { const entry = { at: new Date().toISOString(), event, connectorId, detail }; this.logs.unshift(entry); this.logs.splice(100); await fs.appendFile(path.join(this.root, "connector-events.jsonl"), `${JSON.stringify(entry)}\n`, "utf8"); }
    async restore() { try {
        const saved = JSON.parse(await fs.readFile(path.join(this.root, "connectors.json"), "utf8"));
        for (const connector of saved)
            this.connectors.set(connector.id, connector);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    } }
    async persist() { const target = path.join(this.root, "connectors.json"); const temporary = `${target}.${randomUUID()}.tmp`; await fs.writeFile(temporary, `${JSON.stringify(this.list(), null, 2)}\n`, "utf8"); await fs.rename(temporary, target); }
}
//# sourceMappingURL=connector-manager.js.map