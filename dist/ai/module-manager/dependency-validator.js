import { getCatalogEntry } from "./module-catalog.js";
export class ModuleDependencyValidator {
    validate(plugin, core, declaredDependencies, storageRoot) {
        const checks = [];
        const catalog = getCatalogEntry(plugin.id);
        if (catalog) {
            checks.push({
                name: "catalog-entry",
                passed: true,
                message: `Module ${plugin.id} found in framework catalog`,
            });
        }
        else {
            checks.push({
                name: "catalog-entry",
                passed: false,
                message: `Module ${plugin.id} not in framework catalog`,
            });
        }
        const versionOk = /^\d+\.\d+\.\d+$/.test(plugin.version);
        checks.push({
            name: "version-compatibility",
            passed: versionOk,
            message: versionOk ? `Version ${plugin.version} valid` : `Invalid version ${plugin.version}`,
        });
        for (const dep of declaredDependencies) {
            if (dep === "ai-core") {
                checks.push({
                    name: `required-module:${dep}`,
                    passed: core.isReady(),
                    message: core.isReady() ? "AI Core ready" : "AI Core not ready",
                });
                continue;
            }
            const registry = core.registry;
            const slot = registry.getEntry(dep);
            const pluginRegistered = registry.getPlugin(dep);
            const passed = Boolean(pluginRegistered) || slot?.status === "initialized";
            checks.push({
                name: `required-module:${dep}`,
                passed,
                message: passed ? `${dep} available` : `${dep} not registered or initialized`,
            });
        }
        const configOk = Boolean(core.getConfig());
        checks.push({
            name: "configuration",
            passed: configOk,
            message: configOk ? "Configuration loaded" : "Configuration missing",
        });
        const storageOk = Boolean(storageRoot?.length);
        checks.push({
            name: "storage",
            passed: storageOk,
            message: storageOk ? `Storage root ${storageRoot}` : "Storage root missing",
        });
        checks.push({
            name: "database",
            passed: true,
            message: "Database check deferred (local-first, no DB required)",
        });
        checks.push({
            name: "runtime",
            passed: core.isReady(),
            message: core.isReady() ? "Runtime ready" : "Runtime not ready",
        });
        const failed = checks.filter((c) => !c.passed);
        return {
            compatible: failed.length === 0,
            checks,
            rejectionReason: failed.length ? failed.map((f) => f.message).join("; ") : undefined,
        };
    }
}
//# sourceMappingURL=dependency-validator.js.map