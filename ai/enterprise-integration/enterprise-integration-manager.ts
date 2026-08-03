import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiConnectorManager } from "../connector-management/connector-manager.js";
import type { ConnectorRequest } from "../connector-management/types.js";
import type { ApiGatewayRequest, ApiGatewayResponse, ApiGatewayRoute, EnterpriseIntegrationStatus, WebhookDefinition, WebhookResult } from "./types.js";

interface IntegrationStore { routes: ApiGatewayRoute[]; webhooks: WebhookDefinition[]; }
const EMPTY_STORE: IntegrationStore = { routes: [], webhooks: [] };

/** Gateway and webhook control plane that composes Connector Management; it never owns credentials or provider clients. */
export class EnterpriseIntegrationManager {
  private root = "";
  private statePath = "";
  private initialized = false;
  private store: IntegrationStore = structuredClone(EMPTY_STORE);
  private readonly requestDurations: number[] = [];
  private requestFailures = 0;
  private webhookFailures = 0;

  constructor(private readonly connectors: AiConnectorManager) {}

  async initialize(storageRoot: string): Promise<void> {
    this.root = path.join(storageRoot, "enterprise-integration");
    this.statePath = path.join(this.root, "integration-state.json");
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
    this.initialized = true;
    await this.persist();
  }

  isInitialized(): boolean { return this.initialized; }
  listRoutes(): ApiGatewayRoute[] { this.ensureReady(); return structuredClone(this.store.routes); }
  listWebhooks(): WebhookDefinition[] { this.ensureReady(); return structuredClone(this.store.webhooks); }

  async registerRoute(route: ApiGatewayRoute): Promise<ApiGatewayRoute> {
    this.ensureReady(); this.validateRoute(route);
    if (this.store.routes.some((item) => item.id === route.id)) throw new Error("Gateway route already registered");
    this.store.routes.push(structuredClone(route)); await this.persist(); return structuredClone(route);
  }

  async registerWebhook(webhook: WebhookDefinition): Promise<WebhookDefinition> {
    this.ensureReady(); this.validateWebhook(webhook);
    if (this.store.webhooks.some((item) => item.id === webhook.id)) throw new Error("Webhook already registered");
    this.store.webhooks.push(structuredClone(webhook)); await this.persist(); return structuredClone(webhook);
  }

  async invoke(request: ApiGatewayRequest): Promise<ApiGatewayResponse> {
    this.ensureReady(); const started = performance.now();
    try {
      const route = this.store.routes.find((item) => item.id === request.routeId);
      if (!route) throw new Error("Gateway route not found");
      this.requirePermissions(route.requiredPermissions, request.permissions);
      if (route.protocol === "graphql") return this.reject(request.routeId, 501, "GraphQL transport is architecture-ready but not implemented", started);
      if (route.target !== "connector" || !route.connectorId || !route.connectorPath) return this.reject(request.routeId, 501, "Local gateway handlers require an installed trusted plugin", started);
      const connectorRequest: ConnectorRequest = { connectorId: route.connectorId, path: route.connectorPath, method: route.method, body: request.body, headers: request.headers, permissions: request.permissions };
      const result = await this.connectors.execute(connectorRequest);
      const durationMs = Math.round(performance.now() - started); this.requestDurations.push(durationMs);
      if (result.status === "succeeded" || result.status === "fallback-succeeded") return { routeId: route.id, status: "succeeded", statusCode: result.statusCode ?? 200, data: result.data, durationMs };
      this.requestFailures++; return { routeId: route.id, status: "unavailable", statusCode: result.statusCode ?? 502, error: result.error ?? "Connector request failed", durationMs };
    } catch (error) { return this.reject(request.routeId, 400, error instanceof Error ? error.message : String(error), started); }
  }

  async receiveWebhook(webhookId: string, payload: unknown, signature: string | undefined, permissions?: string[]): Promise<WebhookResult> {
    this.ensureReady(); const webhook = this.requireWebhook(webhookId, "incoming");
    try {
      this.requirePermissions(webhook.requiredPermissions, permissions);
      if (!webhook.secretId) throw new Error("Incoming webhook requires a signing secret");
      const expected = createHmac("sha256", this.connectors.secrets.get(webhook.secretId)).update(JSON.stringify(payload)).digest("hex");
      if (!signature || !safeEqual(expected, signature)) throw new Error("Webhook signature is invalid");
      return { webhookId, status: "accepted", attempts: 1 };
    } catch (error) { this.webhookFailures++; return { webhookId, status: "rejected", attempts: 1, error: error instanceof Error ? error.message : String(error) }; }
  }

  async deliverWebhook(webhookId: string, payload: unknown, permissions?: string[]): Promise<WebhookResult> {
    this.ensureReady(); const webhook = this.requireWebhook(webhookId, "outgoing");
    try {
      this.requirePermissions(webhook.requiredPermissions, permissions);
      if (!webhook.connectorId || !webhook.path) throw new Error("Outgoing webhook requires connector routing");
      for (let attempts = 1; attempts <= webhook.retryAttempts; attempts++) {
        const response = await this.connectors.execute({ connectorId: webhook.connectorId, path: webhook.path, method: "POST", body: payload, permissions });
        if (response.status === "succeeded" || response.status === "fallback-succeeded") return { webhookId, status: "delivered", attempts };
      }
      throw new Error("Webhook delivery failed after retry policy");
    } catch (error) { this.webhookFailures++; return { webhookId, status: "failed", attempts: webhook.retryAttempts, error: error instanceof Error ? error.message : String(error) }; }
  }

  getStatus(): EnterpriseIntegrationStatus {
    this.ensureReady(); const connectors = this.connectors.list(); const durations = this.requestDurations;
    return { initialized: true, externalIntegrationsOptional: true, gateway: { routes: this.store.routes.length, requests: durations.length, failures: this.requestFailures, averageResponseMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0, graphql: "architecture-ready" }, webhooks: { registered: this.store.webhooks.length, incoming: this.store.webhooks.filter((item) => item.direction === "incoming").length, outgoing: this.store.webhooks.filter((item) => item.direction === "outgoing").length, failures: this.webhookFailures }, connectors: { total: connectors.length, enabled: connectors.filter((item) => item.status === "enabled").length, unhealthy: connectors.filter((item) => item.health.stability === "unhealthy").length } };
  }

  private reject(routeId: string, statusCode: number, error: string, started: number): ApiGatewayResponse { const durationMs = Math.round(performance.now() - started); this.requestDurations.push(durationMs); this.requestFailures++; return { routeId, status: "rejected", statusCode, error, durationMs }; }
  private requireWebhook(id: string, direction: WebhookDefinition["direction"]): WebhookDefinition { const webhook = this.store.webhooks.find((item) => item.id === id && item.direction === direction); if (!webhook) throw new Error("Webhook not found"); return webhook; }
  private requirePermissions(required: string[], granted?: string[]): void { const values = new Set(granted ?? []); if (required.some((permission) => !values.has(permission))) throw new Error("Required integration permission was not granted"); }
  private validateRoute(route: ApiGatewayRoute): void { if (!validId(route.id) || !route.path.startsWith("/") || route.path.startsWith("//")) throw new Error("Gateway route is invalid"); if (route.protocol === "graphql" && route.target !== "connector") throw new Error("GraphQL routes require a connector target"); if (route.target === "connector" && (!route.connectorId || !route.connectorPath?.startsWith("/"))) throw new Error("Connector route requires a connector id and relative path"); }
  private validateWebhook(webhook: WebhookDefinition): void { if (!validId(webhook.id) || !webhook.event.trim() || !Number.isInteger(webhook.retryAttempts) || webhook.retryAttempts < 1 || webhook.retryAttempts > 5) throw new Error("Webhook definition is invalid"); if (webhook.direction === "incoming" && !webhook.secretId) throw new Error("Incoming webhook requires a signing secret"); if (webhook.direction === "outgoing" && (!webhook.connectorId || !webhook.path?.startsWith("/"))) throw new Error("Outgoing webhook requires connector routing"); }
  private async readStore(): Promise<IntegrationStore> { try { const data = JSON.parse(await fs.readFile(this.statePath, "utf8")) as Partial<IntegrationStore>; return { routes: data.routes ?? [], webhooks: data.webhooks ?? [] }; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STORE); throw error; } }
  private async persist(): Promise<void> { const temporary = `${this.statePath}.${randomUUID()}.tmp`; await fs.writeFile(temporary, `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); await fs.rename(temporary, this.statePath); }
  private ensureReady(): void { if (!this.initialized) throw new Error("Enterprise Integration Manager is not initialized"); }
}

function validId(value: string): boolean { return /^[a-z0-9][a-z0-9.-]{2,100}$/i.test(value); }
function safeEqual(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }