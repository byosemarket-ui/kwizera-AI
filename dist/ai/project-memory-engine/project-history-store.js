import fs from "node:fs";
import path from "node:path";
export class ProjectHistoryStore {
    historyPath = null;
    events = [];
    initialize(projectDir) {
        fs.mkdirSync(projectDir, { recursive: true });
        this.historyPath = path.join(projectDir, "project-history.jsonl");
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
    getByProject(projectId) {
        return this.events.filter((e) => e.projectId === projectId);
    }
    getCount() {
        return this.events.length;
    }
}
//# sourceMappingURL=project-history-store.js.map