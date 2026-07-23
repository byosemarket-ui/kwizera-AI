import { UserPreferences } from "./types.js";
import { LearningMemoryLogger } from "./learning-logger.js";
export declare class PreferenceStore {
    private readonly logger;
    private prefsPath;
    private preferences;
    constructor(logger: LearningMemoryLogger);
    initialize(learningDir: string): void;
    update(partial: Partial<UserPreferences>): UserPreferences;
    get(): UserPreferences;
    getPreferenceCount(): number;
    getPrefsPath(): string;
}
//# sourceMappingURL=preference-store.d.ts.map