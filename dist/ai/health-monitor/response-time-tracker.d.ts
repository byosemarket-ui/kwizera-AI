import { ResponseTimeMetrics } from "./types.js";
export declare class ResponseTimeTracker {
    private readonly samples;
    record(metrics: Partial<ResponseTimeMetrics>): void;
    getLatest(): ResponseTimeMetrics;
    getAverage(): ResponseTimeMetrics;
    private empty;
}
//# sourceMappingURL=response-time-tracker.d.ts.map