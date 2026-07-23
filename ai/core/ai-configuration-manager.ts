import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AiCoreConfiguration,
  AiCoreError,
  AiInitializationDiagnostic,
  AiSettingsConfig,
  ApplicationConfig,
  BrandAppConfig,
  EnvironmentConfig,
  FutureModulesConfig,
  LanguageConfig,
  StorageConfig,
} from "./types.js";
import type { AiCoreLogger } from "./logger.js";
import { resolveStorageRoot } from "../../storage/paths/storage-paths.js";

function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new AiCoreError(`Configuration file not found: ${filePath}`, "CONFIG_NOT_FOUND");
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export interface AiConfigurationManagerOptions {
  configRoot?: string;
  storageRootOverride?: string;
}

export class AiConfigurationManager {
  private configuration: AiCoreConfiguration | null = null;
  private readonly configRoot: string;

  constructor(options: AiConfigurationManagerOptions = {}) {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(moduleDir, "..", "..");
    this.configRoot = options.configRoot ?? path.join(projectRoot, "config", "defaults");
  }

  load(logger: AiCoreLogger, storageRootOverride?: string): AiCoreConfiguration {
    const diagnosticBase = { stage: "configuration", timestamp: new Date().toISOString() };

    try {
      const application = readJsonFile<ApplicationConfig>(
        path.join(this.configRoot, "application.json")
      );
      const environment = readJsonFile<EnvironmentConfig>(
        path.join(this.configRoot, "environment.json")
      );
      const storageDefaults = readJsonFile<StorageConfig>(
        path.join(this.configRoot, "storage.json")
      );
      const language = readJsonFile<LanguageConfig>(
        path.join(this.configRoot, "language.json")
      );
      const brand = readJsonFile<BrandAppConfig>(
        path.join(this.configRoot, "brand-app.json")
      );
      const ai = readJsonFile<AiSettingsConfig>(path.join(this.configRoot, "ai.json"));
      const futureModules = readJsonFile<FutureModulesConfig>(
        path.join(this.configRoot, "future-modules.json")
      );

      const storageRoot = resolveStorageRoot(
        storageRootOverride ?? process.env.KWIZERA_STORAGE_ROOT ?? storageDefaults.storageRoot
      );

      const storage: StorageConfig = {
        ...storageDefaults,
        storageRoot,
      };

      this.configuration = {
        application,
        environment,
        storage,
        language,
        brand,
        ai,
        futureModules,
        loadedAt: new Date().toISOString(),
        configRoot: this.configRoot,
      };

      logger.info("configuration", "AI Core configuration loaded", {
        applicationName: application.applicationName,
        version: application.applicationVersion,
        storageRoot,
      });

      return this.configuration;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const diagnostic: AiInitializationDiagnostic = {
        ...diagnosticBase,
        success: false,
        message: "Configuration load failed",
        error: message,
      };
      logger.error("configuration", diagnostic.message, { error: message });
      throw new AiCoreError(message, "CONFIG_LOAD_FAILED", diagnostic);
    }
  }

  getConfiguration(): AiCoreConfiguration {
    if (!this.configuration) {
      throw new AiCoreError("Configuration not loaded", "CONFIG_NOT_LOADED");
    }
    return this.configuration;
  }

  isLoaded(): boolean {
    return this.configuration !== null;
  }

  ensureStorageDirectories(logger: AiCoreLogger): void {
    const config = this.getConfiguration();
    const root = config.storage.storageRoot;

    const requiredDirs = [
      root,
      ...Object.values(config.storage.directories).map((dir) => path.join(root, dir)),
    ];

    for (const dir of requiredDirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    logger.info("configuration", "Storage directories ensured", { storageRoot: root });
  }
}
