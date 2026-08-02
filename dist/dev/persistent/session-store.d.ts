export declare const SESSION_VERSION = 1;
export interface DevUiState {
    filter: string;
    openPhases: string[];
}
export interface DevRuntimeSnapshot {
    readinessScore: number;
    memoryLoaded: boolean;
    knowledgeLoaded: boolean;
    projectStateRestored: boolean;
    modulesConnected: number;
    lifecycleState: string;
    memoryReadiness: number | null;
    knowledgeReadiness: number | null;
    projectCount: number;
}
export interface DevSessionState {
    version: number;
    sessionId: string;
    createdAt: string;
    lastStartedAt: string;
    lastShutdownAt: string | null;
    startCount: number;
    dashboardUrl: string;
    storageRoot: string;
    persistentMode: boolean;
    autoStartEnabled: boolean;
    ui: DevUiState;
    lastRuntime: DevRuntimeSnapshot;
}
export declare function createDefaultSession(storageRoot: string, dashboardUrl: string): DevSessionState;
export declare class DevSessionStore {
    private readonly sessionPath;
    private session;
    constructor(storageRoot: string, dashboardUrl: string);
    private loadOrCreate;
    get(): DevSessionState;
    updateRuntime(snapshot: Partial<DevRuntimeSnapshot>): void;
    updateUi(ui: Partial<DevUiState>): void;
    markAutoStart(enabled: boolean): void;
    markShutdown(): void;
    persist(): void;
}
//# sourceMappingURL=session-store.d.ts.map