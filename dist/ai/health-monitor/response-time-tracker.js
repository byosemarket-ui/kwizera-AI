export class ResponseTimeTracker {
    samples = [];
    record(metrics) {
        const latest = this.samples[this.samples.length - 1] ?? this.empty();
        this.samples.push({ ...latest, ...metrics });
    }
    getLatest() {
        return this.samples[this.samples.length - 1] ?? this.empty();
    }
    getAverage() {
        if (this.samples.length === 0)
            return this.empty();
        const sum = this.samples.reduce((acc, s) => ({
            moduleResponseMs: acc.moduleResponseMs + s.moduleResponseMs,
            apiResponseMs: acc.apiResponseMs + s.apiResponseMs,
            databaseResponseMs: acc.databaseResponseMs + s.databaseResponseMs,
            storageResponseMs: acc.storageResponseMs + s.storageResponseMs,
            communicationLatencyMs: acc.communicationLatencyMs + s.communicationLatencyMs,
            aiResponseMs: acc.aiResponseMs + s.aiResponseMs,
        }), this.empty());
        const n = this.samples.length;
        return {
            moduleResponseMs: Math.round(sum.moduleResponseMs / n),
            apiResponseMs: Math.round(sum.apiResponseMs / n),
            databaseResponseMs: Math.round(sum.databaseResponseMs / n),
            storageResponseMs: Math.round(sum.storageResponseMs / n),
            communicationLatencyMs: Math.round(sum.communicationLatencyMs / n),
            aiResponseMs: Math.round(sum.aiResponseMs / n),
        };
    }
    empty() {
        return {
            moduleResponseMs: 0,
            apiResponseMs: 0,
            databaseResponseMs: 0,
            storageResponseMs: 0,
            communicationLatencyMs: 0,
            aiResponseMs: 0,
        };
    }
}
//# sourceMappingURL=response-time-tracker.js.map