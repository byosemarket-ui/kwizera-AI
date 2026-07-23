import { ModuleRegistryRecord } from "../module-manager/types.js";
import { ChannelRegistry } from "./channel-registry.js";
import { BusMessage, BusValidationResult } from "./types.js";
export interface MessageValidatorDeps {
    resolveRecord: (id: string) => ModuleRegistryRecord | undefined;
    isIsolated: (id: string) => boolean;
    channels: ChannelRegistry;
    isDependencyAvailable: (dep: string) => boolean;
}
export declare class MessageValidator {
    private readonly deps;
    constructor(deps: MessageValidatorDeps);
    validate(message: BusMessage): BusValidationResult;
}
//# sourceMappingURL=message-validator.d.ts.map