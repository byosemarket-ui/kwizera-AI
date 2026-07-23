import { BusChannelDefinition } from "./types.js";
/** Framework communication channels — management only */
export declare const FRAMEWORK_CHANNEL_CATALOG: BusChannelDefinition[];
export declare class ChannelRegistry {
    private readonly channels;
    registerAll(definitions: BusChannelDefinition[]): void;
    get(moduleId: string): BusChannelDefinition | undefined;
    getAll(): BusChannelDefinition[];
    getCount(): number;
    setActive(moduleId: string, active: boolean): void;
}
//# sourceMappingURL=channel-registry.d.ts.map