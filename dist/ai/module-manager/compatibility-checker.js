import { getCatalogEntry } from "./module-catalog.js";
export class ModuleCompatibilityChecker {
    verify(plugin) {
        const catalog = getCatalogEntry(plugin.id);
        if (!catalog) {
            return { compatible: false, message: `No catalog entry for ${plugin.id}` };
        }
        const minVersion = catalog.compatibility.replace(">=", "");
        const pluginParts = plugin.version.split(".").map(Number);
        const minParts = minVersion.split(".").map(Number);
        for (let i = 0; i < 3; i++) {
            const p = pluginParts[i] ?? 0;
            const m = minParts[i] ?? 0;
            if (p > m)
                return { compatible: true, message: "Version compatible" };
            if (p < m) {
                return {
                    compatible: false,
                    message: `Version ${plugin.version} below required ${catalog.compatibility}`,
                };
            }
        }
        return { compatible: true, message: "Version compatible" };
    }
}
//# sourceMappingURL=compatibility-checker.js.map