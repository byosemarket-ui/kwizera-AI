import fs from "node:fs";
import path from "node:path";
export class MarketingHistoryStore {
    historyPath = null;
    events = [];
    initialize(marketingDir) {
        fs.mkdirSync(marketingDir, { recursive: true });
        this.historyPath = path.join(marketingDir, "marketing-history.jsonl");
        if (fs.existsSync(this.historyPath)) {
            const lines = fs.readFileSync(this.historyPath, "utf8").trim().split("\n").filter(Boolean);
            for (const line of lines) {
                this.events.push(JSON.parse(line));
            }
        }
    }
    append(event) {
        this.events.push(event);
        if (this.historyPath) {
            fs.appendFileSync(this.historyPath, `${JSON.stringify(event)}\n`, "utf8");
        }
    }
    getAll() {
        return this.events;
    }
    getByCampaign(campaignId) {
        return this.events.filter((e) => e.campaignId === campaignId);
    }
    getCount() {
        return this.events.length;
    }
}
//# sourceMappingURL=marketing-history-store.js.map