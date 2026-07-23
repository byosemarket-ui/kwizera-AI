import fs from "node:fs";
import path from "node:path";
export class PreferenceStore {
    logger;
    prefsPath = "";
    preferences = { lastUpdated: new Date().toISOString() };
    constructor(logger) {
        this.logger = logger;
    }
    initialize(learningDir) {
        fs.mkdirSync(learningDir, { recursive: true });
        this.prefsPath = path.join(learningDir, "user-preferences.json");
        if (fs.existsSync(this.prefsPath)) {
            this.preferences = JSON.parse(fs.readFileSync(this.prefsPath, "utf8"));
        }
    }
    update(partial) {
        this.preferences = {
            ...this.preferences,
            ...partial,
            lastUpdated: new Date().toISOString(),
        };
        fs.writeFileSync(this.prefsPath, JSON.stringify(this.preferences, null, 2), "utf8");
        this.logger.log("info", "preference-update", "User preferences updated", {
            fields: Object.keys(partial),
        });
        return this.preferences;
    }
    get() {
        return { ...this.preferences };
    }
    getPreferenceCount() {
        return Object.keys(this.preferences).filter((k) => k !== "lastUpdated").length;
    }
    getPrefsPath() {
        return this.prefsPath;
    }
}
//# sourceMappingURL=preference-store.js.map