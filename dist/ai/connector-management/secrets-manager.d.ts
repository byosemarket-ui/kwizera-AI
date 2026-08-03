/** Encrypts local credentials; callers supply the runtime-only master passphrase. */
export declare class AiSecretsManager {
    private root;
    private passphrase;
    private readonly secrets;
    initialize(storageRoot: string, passphrase?: string | undefined): Promise<void>;
    isUnlocked(): boolean;
    set(secretId: string, value: string): Promise<void>;
    remove(secretId: string): Promise<void>;
    has(secretId: string): boolean;
    get(secretId: string): string;
    private key;
    private restore;
    private persist;
}
//# sourceMappingURL=secrets-manager.d.ts.map