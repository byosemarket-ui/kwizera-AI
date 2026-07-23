import { AiCoreHealthReport, AiCoreConfiguration } from "./types.js";
import type { AiLifecycleManager } from "./lifecycle.js";
import type { AiConfigurationManager } from "./ai-configuration-manager.js";
import type { AiRuntime } from "./ai-runtime.js";
import type { AiModuleRegistry } from "./module-registry.js";
import type { AiCoreLogger } from "./logger.js";
export declare class AiHealthMonitor {
    runChecks(input: {
        lifecycle: AiLifecycleManager;
        configuration: AiConfigurationManager;
        runtime: AiRuntime;
        registry: AiModuleRegistry;
        logger: AiCoreLogger;
        config?: AiCoreConfiguration;
    }): AiCoreHealthReport;
}
//# sourceMappingURL=ai-health-monitor.d.ts.map