import { CustomerMemoryProfile } from "./types.js";
export declare class MarketingCustomerStore {
    private profilePath;
    private profile;
    initialize(marketingDir: string): void;
    learn(partial: Partial<CustomerMemoryProfile>): CustomerMemoryProfile;
    get(): CustomerMemoryProfile;
    getFieldCount(): number;
    private persist;
}
//# sourceMappingURL=marketing-customer-store.d.ts.map