import { AiCoreManager, AiCoreManagerOptions } from "./ai-core-manager.js";
import { APPLICATION_NAME, AI_ASSISTANT_NAME } from "./types.js";

/**
 * KWIZERA AI Core — central intelligent coordinator for KWIZERA AI STUDIO.
 * Step 2A foundation only. No business logic. No future module implementations.
 */
export class AiCore {
  private static instance: AiCore | null = null;
  private readonly manager: AiCoreManager;

  static create(options?: AiCoreManagerOptions): AiCore {
    return new AiCore(options);
  }

  private constructor(options: AiCoreManagerOptions = {}) {
    this.manager = new AiCoreManager(options);
  }

  static getInstance(options?: AiCoreManagerOptions): AiCore {
    if (!AiCore.instance) {
      AiCore.instance = new AiCore(options);
    }
    return AiCore.instance;
  }

  static resetInstance(): void {
    AiCore.instance = null;
  }

  getAssistantName(): typeof AI_ASSISTANT_NAME {
    return AI_ASSISTANT_NAME;
  }

  getApplicationName(): typeof APPLICATION_NAME {
    return APPLICATION_NAME;
  }

  getManager(): AiCoreManager {
    return this.manager;
  }

  async start(correlationId?: string): Promise<void> {
    await this.manager.start(correlationId);
  }

  async stop(reason?: string): Promise<void> {
    await this.manager.stop(reason);
  }

  getStatusReport() {
    return this.manager.getStatusReport();
  }
}

export function createAiCore(options?: AiCoreManagerOptions): AiCore {
  return AiCore.create(options);
}
