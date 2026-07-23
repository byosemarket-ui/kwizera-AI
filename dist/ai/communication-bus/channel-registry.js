import { BusMessageType } from "./types.js";
const ALL_TYPES = Object.values(BusMessageType);
/** Framework communication channels — management only */
export const FRAMEWORK_CHANNEL_CATALOG = [
    { channelId: "ch-ai-core", moduleId: "ai-core", moduleName: "AI Core", supportedTypes: ALL_TYPES, active: true },
    { channelId: "ch-decision-engine", moduleId: "decision-engine", moduleName: "Decision Engine", supportedTypes: ALL_TYPES, active: true },
    { channelId: "ch-reasoning-engine", moduleId: "reasoning-engine", moduleName: "Reasoning Engine", supportedTypes: ALL_TYPES, active: true },
    { channelId: "ch-planning-engine", moduleId: "planning-engine", moduleName: "Planning Engine", supportedTypes: ALL_TYPES, active: true },
    { channelId: "ch-workflow-engine", moduleId: "workflow-engine", moduleName: "Workflow Engine", supportedTypes: ALL_TYPES, active: true },
    { channelId: "ch-task-manager", moduleId: "task-manager", moduleName: "Task Manager", supportedTypes: ALL_TYPES, active: true },
    { channelId: "ch-module-manager", moduleId: "module-manager", moduleName: "Module Manager", supportedTypes: ALL_TYPES, active: true },
    { channelId: "ch-memory-engine", moduleId: "memory-engine", moduleName: "Memory Engine", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-knowledge-engine", moduleId: "knowledge-engine", moduleName: "Knowledge Engine", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-learning-engine", moduleId: "learning-engine", moduleName: "Learning Engine", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-product-intelligence", moduleId: "product-intelligence", moduleName: "Product Intelligence", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-image-intelligence", moduleId: "image-intelligence", moduleName: "Image Intelligence", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-video-intelligence", moduleId: "video-intelligence", moduleName: "Video Intelligence", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-marketing-intelligence", moduleId: "marketing-intelligence", moduleName: "Marketing Intelligence", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-translation-engine", moduleId: "translation-engine", moduleName: "Translation Engine", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-search-engine", moduleId: "search-engine", moduleName: "Search Engine", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-export-engine", moduleId: "export-engine", moduleName: "Export Engine", supportedTypes: ALL_TYPES, active: false },
    { channelId: "ch-recovery-engine", moduleId: "recovery-engine", moduleName: "Recovery Engine", supportedTypes: ALL_TYPES, active: true },
    { channelId: "ch-health-monitor", moduleId: "health-monitor", moduleName: "Health Monitor", supportedTypes: ALL_TYPES, active: true },
];
export class ChannelRegistry {
    channels = new Map();
    registerAll(definitions) {
        for (const def of definitions) {
            this.channels.set(def.moduleId, { ...def });
        }
    }
    get(moduleId) {
        return this.channels.get(moduleId);
    }
    getAll() {
        return Array.from(this.channels.values());
    }
    getCount() {
        return this.channels.size;
    }
    setActive(moduleId, active) {
        const channel = this.channels.get(moduleId);
        if (channel) {
            channel.active = active;
        }
    }
}
//# sourceMappingURL=channel-registry.js.map