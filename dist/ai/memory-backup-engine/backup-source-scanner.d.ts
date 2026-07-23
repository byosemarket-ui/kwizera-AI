import { BackupSource } from "./types.js";
export interface ScannedFile {
    source: BackupSource;
    absolutePath: string;
    relativePath: string;
}
export declare class BackupSourceScanner {
    private readonly storageRoot;
    constructor(storageRoot: string);
    scan(sources?: BackupSource[]): ScannedFile[];
    private walkDirectory;
}
//# sourceMappingURL=backup-source-scanner.d.ts.map