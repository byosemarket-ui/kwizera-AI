import fs from "node:fs";
import path from "node:path";

export interface MarketingHistoryEvent {
  timestamp: string;
  event: "create" | "update" | "complete" | "pattern" | "learn" | "customer";
  campaignId: string;
  projectId: string;
  detail: string;
  version?: number;
}

export class MarketingHistoryStore {
  private historyPath: string | null = null;
  private readonly events: MarketingHistoryEvent[] = [];

  initialize(marketingDir: string): void {
    fs.mkdirSync(marketingDir, { recursive: true });
    this.historyPath = path.join(marketingDir, "marketing-history.jsonl");
    if (fs.existsSync(this.historyPath)) {
      const lines = fs.readFileSync(this.historyPath, "utf8").trim().split("\n").filter(Boolean);
      for (const line of lines) {
        this.events.push(JSON.parse(line) as MarketingHistoryEvent);
      }
    }
  }

  append(event: MarketingHistoryEvent): void {
    this.events.push(event);
    if (this.historyPath) {
      fs.appendFileSync(this.historyPath, `${JSON.stringify(event)}\n`, "utf8");
    }
  }

  getAll(): ReadonlyArray<MarketingHistoryEvent> {
    return this.events;
  }

  getByCampaign(campaignId: string): MarketingHistoryEvent[] {
    return this.events.filter((e) => e.campaignId === campaignId);
  }

  getCount(): number {
    return this.events.length;
  }
}
