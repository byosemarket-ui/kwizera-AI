export const CONNECTOR_CATEGORIES = ["ai-provider", "language-model", "image-generation", "video-generation", "audio", "ocr", "translation", "cloud-storage", "social-media", "e-commerce", "payment", "email", "business", "developer-api", "custom"] as const;
export type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number];

export const AUTHENTICATION_TYPES = ["api-key", "oauth2", "bearer-token", "jwt", "personal-access-token", "custom"] as const;
export type AuthenticationType = (typeof AUTHENTICATION_TYPES)[number];
export type ConnectorStatus = "registered" | "enabled" | "disabled" | "failed" | "removed";
export type ConnectorProfile = "development" | "testing" | "production";

export interface RetryPolicy { maxAttempts: number; initialDelayMs: number; maxDelayMs: number; retryStatusCodes: number[]; }
export interface EndpointConfiguration { baseUrl: string; allowedPaths?: string[]; headers?: Record<string, string>; allowInsecureLocalhost?: boolean; }
export interface ConnectorAuthentication { type: AuthenticationType; secretId?: string; headerName?: string; tokenPrefix?: string; oauthTokenUrl?: string; }
export interface ConnectorDefinition {
  id: string; name: string; description: string; version: string; provider: string; category: ConnectorCategory;
  authentication: ConnectorAuthentication; endpoint: EndpointConfiguration; requiredPermissions: string[];
  retryPolicy: RetryPolicy; timeoutMs: number; fallbackConnectorId?: string;
}
export interface ConnectorHealth { available: boolean; authenticated: boolean; responseTimeMs: number; executionCount: number; failureCount: number; errorRate: number; stability: "healthy" | "degraded" | "unhealthy"; lastCheckedAt: string; }
export interface RegisteredConnector extends ConnectorDefinition { status: ConnectorStatus; health: ConnectorHealth; profiles: Partial<Record<ConnectorProfile, Partial<Pick<ConnectorDefinition, "endpoint" | "authentication" | "timeoutMs" | "retryPolicy">>>>; registeredAt: string; updatedAt: string; lastError?: string; }
export interface ConnectorRequest { connectorId: string; path: string; method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; headers?: Record<string, string>; body?: unknown; permissions?: string[]; profile?: ConnectorProfile; }
export interface ConnectorResponse { connectorId: string; status: "succeeded" | "rejected" | "failed" | "fallback-succeeded"; statusCode?: number; data?: unknown; error?: string; attempts: number; durationMs: number; fallbackConnectorId?: string; }
export interface HttpRequest { url: string; method: string; headers: Record<string, string>; body?: string; timeoutMs: number; }
export interface HttpResponse { status: number; headers: Record<string, string>; body: unknown; }
export type ConnectorTransport = (request: HttpRequest) => Promise<HttpResponse>;
