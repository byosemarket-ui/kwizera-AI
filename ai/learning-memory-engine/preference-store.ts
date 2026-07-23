import fs from "node:fs";
import path from "node:path";
import { UserPreferences } from "./types.js";
import { LearningMemoryLogger } from "./learning-logger.js";

export class PreferenceStore {
  private prefsPath = "";
  private preferences: UserPreferences = { lastUpdated: new Date().toISOString() };

  constructor(private readonly logger: LearningMemoryLogger) {}

  initialize(learningDir: string): void {
    fs.mkdirSync(learningDir, { recursive: true });
    this.prefsPath = path.join(learningDir, "user-preferences.json");
    if (fs.existsSync(this.prefsPath)) {
      this.preferences = JSON.parse(fs.readFileSync(this.prefsPath, "utf8")) as UserPreferences;
    }
  }

  update(partial: Partial<UserPreferences>): UserPreferences {
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

  get(): UserPreferences {
    return { ...this.preferences };
  }

  getPreferenceCount(): number {
    return Object.keys(this.preferences).filter((k) => k !== "lastUpdated").length;
  }

  getPrefsPath(): string {
    return this.prefsPath;
  }
}
