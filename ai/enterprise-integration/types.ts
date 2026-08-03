export type GatewayProtocol = "rest" | "graphql" | "local" | "internal";
export type GatewayRouteTarget = "connector" | "local";

export interface ApiGatewayRoute {
  id: string;
  protocol: GatewayProtocol;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  target: GatewayRouteTarget;
  connectorId?: string;
  connectorPath?: string;
  requiredPermissions: string[];
}

export interface ApiGatewayRequest {
  routeId: string;
  body?: unknown;
  headers?: Record<string, string>;
  permissions?: string[];
}

export interface ApiGatewayResponse {
  routeId: string;
  status: "succeeded" | "rejected" | "unavailable";
  statusCode: number;
  data?: unknown;
  error?: string;
  durationMs: number;
}

export interface WebhookDefinition {
  id: string;
  direction: "incoming" | "outgoing";
  event: string;
  connectorId?: string;
  path?: string;
  secretId?: string;
  retryAttempts: number;
  requiredPermissions: string[];
}

export interface WebhookResult {
  webhookId: string;
  status: "accepted" | "rejected" | "delivered" | "failed";
  attempts: number;
  error?: string;
}

export interface EnterpriseIntegrationStatus {
  initialized: boolean;
  externalIntegrationsOptional: true;
  gateway: { routes: number; requests: number; failures: number; averageResponseMs: number; graphql: "architecture-ready" };
  webhooks: { registered: number; incoming: number; outgoing: number; failures: number };
  connectors: { total: number; enabled: number; unhealthy: number };
}