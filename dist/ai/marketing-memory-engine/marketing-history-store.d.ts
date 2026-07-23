export interface MarketingHistoryEvent {
    timestamp: string;
    event: "create" | "update" | "complete" | "pattern" | "learn" | "customer";
    campaignId: string;
    projectId: string;
    detail: string;
    version?: number;
}
export declare class MarketingHistoryStore {
    private historyPath;
    private readonly events;
    initialize(marketingDir: string): void;
    append(event: MarketingHistoryEvent): void;
    getAll(): ReadonlyArray<MarketingHistoryEvent>;
    getByCampaign(campaignId: string): MarketingHistoryEvent[];
    getCount(): number;
}
//# sourceMappingURL=marketing-history-store.d.ts.map