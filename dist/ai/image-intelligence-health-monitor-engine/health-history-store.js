import fs from "node:fs";
import path from "node:path";
export class ImageIntelligenceHealthHistoryStore {
    historyPath = "";
    entries = [];
    initialize(healthDir) {
        fs.mkdirSync(healthDir, { recursive: true });
        this.historyPath = path.join(healthDir, "health-history.json");
        if (fs.existsSync(this.historyPath)) {
            this.entries = JSON.parse(fs.readFileSync(this.historyPath, "utf8"));
        }
    }
    append(entry) {
        this.entries.push(entry);
        if (this.entries.length > 500) {
            this.entries = this.entries.slice(-500);
        }
        this.persist();
    }
    getAll() {
        return [...this.entries];
    }
    getRecent(count = 10) {
        return this.entries.slice(-count);
    }
    persist() {
        fs.writeFileSync(this.historyPath, JSON.stringify(this.entries, null, 2), "utf8");
    }
}
export class ImageIntelligenceTrendAnalyzer {
    analyze(history) {
        if (history.length < 2) {
            return {
                direction: "stable",
                averageScore: history[0]?.healthScore ?? 100,
                scoreChange: 0,
                warningTrend: 0,
                prediction: "Insufficient data — image intelligence monitoring continues",
            };
        }
        const recent = history.slice(-10);
        const older = history.slice(-20, -10);
        const recentAvg = recent.reduce((s, e) => s + e.healthScore, 0) / recent.length;
        const olderAvg = older.length > 0 ? older.reduce((s, e) => s + e.healthScore, 0) / older.length : recentAvg;
        const scoreChange = Math.round(recentAvg - olderAvg);
        const recentWarnings = recent.reduce((s, e) => s + e.warnings.length, 0);
        const olderWarnings = older.reduce((s, e) => s + e.warnings.length, 0);
        const warningTrend = recentWarnings - olderWarnings;
        let direction = "stable";
        if (scoreChange > 2)
            direction = "improving";
        else if (scoreChange < -2)
            direction = "declining";
        let prediction = "Image intelligence system health is stable";
        if (direction === "declining") {
            prediction = "Image intelligence health declining — run optimization within 24 hours";
        }
        else if (warningTrend > 3) {
            prediction = "Warning frequency increasing — image intelligence audit recommended";
        }
        else if (direction === "improving") {
            prediction = "Image intelligence health improving — continue current maintenance";
        }
        return {
            direction,
            averageScore: Math.round(recentAvg),
            scoreChange,
            warningTrend,
            prediction,
        };
    }
}
//# sourceMappingURL=health-history-store.js.map