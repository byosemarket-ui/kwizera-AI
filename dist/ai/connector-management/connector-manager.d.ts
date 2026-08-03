import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiToolManager } from "../tool-management/tool-manager.js";
import { AiSecretsManager } from "./secrets-manager.js";
import { type ConnectorDefinition, type ConnectorHealth, type ConnectorProfile, type ConnectorRequest, type ConnectorResponse, type ConnectorTransport, type RegisteredConnector } from "./types.js";
/** Central local-first registry and secure executor for approved external service connectors. */
export declare class AiConnectorManager {
    private readonly transport;
    readonly secrets: AiSecretsManager;
    private root;
    private core;
    private tools;
    private initialized;
    private readonly connectors;
    private readonly logs;
    constructor(transport?: ConnectorTransport);
    initialize(core: AiCoreManager, tools: AiToolManager, storageRoot: string, secretsPassphrase?: string): Promise<void>;
    isInitialized(): boolean;
    list(category?: RegisteredConnector["category"]): RegisteredConnector[];
    get(connectorId: string): RegisteredConnector | null;
    getLogs(): ReadonlyArray<{
        at: string;
        event: string;
        connectorId?: string;
        detail: string;
    }>;
    register(definition: ConnectorDefinition): Promise<RegisteredConnector>;
    discover(definitions: ConnectorDefinition[]): Promise<number>;
    enable(connectorId: string): Promise<void>;
    disable(connectorId: string): Promise<void>;
    remove(connectorId: string): Promise<void>;
    update(connectorId: string, changes: Partial<Pick<ConnectorDefinition, "name" | "description" | "version" | "endpoint" | "authentication" | "retryPolicy" | "timeoutMs" | "fallbackConnectorId">>): Promise<RegisteredConnector>;
    configureProfile(connectorId: string, profile: ConnectorProfile, configuration: RegisteredConnector["profiles"][ConnectorProfile]): Promise<RegisteredConnector>;
    validate(connectorId: string): {
        valid: boolean;
        errors: string[];
    };
    execute(request: ConnectorRequest): Promise<ConnectorResponse>;
    monitor(connectorId?: string): Promise<Record<string, ConnectorHealth>>;
    getIntegrationStatus(): Record<string, boolean>;
    private executeInternal;
    private resolveProfile;
    private headers;
    private validateRequest;
    private validateConnector;
    private validateDefinition;
    private validatePermissions;
    private record;
    private retryDelay;
    private delay;
    private require;
    private ensureReady;
    private log;
    private restore;
    private persist;
}
//# sourceMappingURL=connector-manager.d.ts.map