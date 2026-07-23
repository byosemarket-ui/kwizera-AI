import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { StateComparison } from "./types.js";
export declare class StateComparator {
    private readonly foundation;
    constructor(foundation: AiMemoryFoundation);
    compare(backupId: string): StateComparison;
}
//# sourceMappingURL=state-comparator.d.ts.map