import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { RegisteredTool, ToolDefinition, ToolExecutionRequest, ToolExecutionResult, ToolHandler, ToolHealth } from "./types.js";
import { TOOL_CATEGORIES } from "./types.js";

const emptyHealth = (): ToolHealth => ({ available: true, compatible: true, responseTimeMs: 0, executionCount: 0, failureCount: 0, errorRate: 0, lastCheckedAt: new Date().toISOString() });

/** Central local-first registry and permission-gated executor for KWIZERA capabilities. */
export class AiToolManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly handlers = new Map<string, ToolHandler>();
  private initialized = false;

  async initialize(core: AiCoreManager, storageRoot: string): Promise<void> {
    this.core = core;
    this.root = path.join(storageRoot, "tool-management");
    await fs.mkdir(this.root, { recursive: true });
    await this.restore();
    this.initialized = true;
  }

  isInitialized(): boolean { return this.initialized; }
  list(category?: RegisteredTool["category"]): RegisteredTool[] { return [...this.tools.values()].filter((tool) => !category || tool.category === category).map((tool) => structuredClone(tool)); }
  get(toolId: string): RegisteredTool | null { const tool = this.tools.get(toolId); return tool ? structuredClone(tool) : null; }

  async register(definition: ToolDefinition, handler: ToolHandler, configuration: Record<string, unknown> = {}): Promise<RegisteredTool> {
    this.ensureReady(); this.validateDefinition(definition);
    if (this.tools.has(definition.id)) throw new Error(`Tool already registered: ${definition.id}`);
    const now = new Date().toISOString();
    const tool: RegisteredTool = { ...definition, status: "enabled", configuration: structuredClone(configuration), health: emptyHealth(), registeredAt: now, updatedAt: now };
    this.tools.set(tool.id, tool); this.handlers.set(tool.id, handler); await this.persist();
    return structuredClone(tool);
  }

  async discover(tools: Array<{ definition: ToolDefinition; handler: ToolHandler; configuration?: Record<string, unknown> }>): Promise<number> {
    let discovered = 0;
    for (const tool of tools) {
      if (!this.tools.has(tool.definition.id)) { await this.register(tool.definition, tool.handler, tool.configuration); discovered++; }
      else this.handlers.set(tool.definition.id, tool.handler);
    }
    return discovered;
  }

  async remove(toolId: string): Promise<void> { this.ensureReady(); this.require(toolId); this.tools.delete(toolId); this.handlers.delete(toolId); await this.persist(); }
  async update(toolId: string, changes: Partial<Pick<ToolDefinition, "name" | "description" | "version" | "dependencies" | "supportedModels">>): Promise<RegisteredTool> { const tool = this.require(toolId); Object.assign(tool, changes, { updatedAt: new Date().toISOString() }); await this.persist(); return structuredClone(tool); }
  async enable(toolId: string): Promise<void> { const tool = this.require(toolId); tool.status = "enabled"; tool.updatedAt = new Date().toISOString(); await this.persist(); }
  async disable(toolId: string): Promise<void> { const tool = this.require(toolId); tool.status = "disabled"; tool.updatedAt = new Date().toISOString(); await this.persist(); }
  async load(toolId: string): Promise<void> { const tool = this.require(toolId); if (tool.status === "disabled") throw new Error(`Tool is disabled: ${toolId}`); tool.status = "loaded"; await this.persist(); }
  async unload(toolId: string): Promise<void> { const tool = this.require(toolId); if (tool.status !== "disabled") tool.status = "enabled"; await this.persist(); }
  async configure(toolId: string, configuration: Record<string, unknown>): Promise<RegisteredTool> { const tool = this.require(toolId); tool.configuration = structuredClone(configuration); tool.updatedAt = new Date().toISOString(); await this.persist(); return structuredClone(tool); }

  validate(toolId: string): { valid: boolean; errors: string[] } { const tool = this.require(toolId); const errors: string[] = []; try { this.validateDefinition(tool); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); } if (!this.handlers.has(toolId)) errors.push("No executable handler is loaded"); return { valid: errors.length === 0, errors }; }
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const started = performance.now(); const executionId = randomUUID();
    try {
      const tool = this.require(request.toolId); if (tool.status !== "enabled" && tool.status !== "loaded") throw new Error(`Tool is not enabled: ${tool.id}`);
      const validation = this.validate(tool.id); if (!validation.valid) throw new Error(validation.errors.join("; "));
      this.validateInput(tool, request.input); const granted = new Set(request.permissions ?? []);
      if (tool.requiredPermissions.some((permission) => !granted.has(permission))) throw new Error("Required tool permission was not granted");
      const handler = this.handlers.get(tool.id)!; const output = await handler(structuredClone(request.input));
      this.record(tool, performance.now() - started, true); await this.persist(); return { executionId, toolId: tool.id, status: "succeeded", output, durationMs: Math.round(performance.now() - started) };
    } catch (error) {
      const tool = this.tools.get(request.toolId); if (tool) { this.record(tool, performance.now() - started, false); await this.persist(); }
      return { executionId, toolId: request.toolId, status: "rejected", error: error instanceof Error ? error.message : String(error), durationMs: Math.round(performance.now() - started) };
    }
  }

  async monitor(toolId?: string): Promise<Record<string, ToolHealth>> { const targets = toolId ? [this.require(toolId)] : [...this.tools.values()]; for (const tool of targets) { tool.health.available = this.handlers.has(tool.id); tool.health.compatible = tool.dependencies.every((dependency) => dependency === "ai-core" || Boolean(this.core?.registry.getEntry(dependency))); tool.health.lastCheckedAt = new Date().toISOString(); } await this.persist(); return Object.fromEntries(targets.map((tool) => [tool.id, structuredClone(tool.health)])); }
  getIntegrationStatus(): Record<string, boolean> { return { aiCore: Boolean(this.core), workflowEngine: Boolean(this.core?.workflowEngine), taskScheduler: Boolean(this.core?.taskManager), communicationBus: Boolean(this.core?.communicationBus), moduleManager: Boolean(this.core?.moduleManager), multiAgentSystem: false }; }

  private record(tool: RegisteredTool, duration: number, success: boolean): void { tool.health.executionCount++; if (!success) tool.health.failureCount++; tool.health.responseTimeMs = Math.round(duration); tool.health.errorRate = tool.health.executionCount ? Math.round(tool.health.failureCount / tool.health.executionCount * 100) : 0; tool.health.lastCheckedAt = new Date().toISOString(); }
  private validateInput(tool: RegisteredTool, input: Record<string, unknown>): void { for (const key of tool.inputSchema.required ?? []) if (!(key in input)) throw new Error(`Missing required tool input: ${key}`); }
  private validateDefinition(tool: ToolDefinition): void { if (!/^[a-z0-9][a-z0-9.-]{2,100}$/i.test(tool.id)) throw new Error("Tool id is invalid"); if (!tool.name.trim() || !tool.description.trim()) throw new Error("Tool name and description are required"); if (!TOOL_CATEGORIES.includes(tool.category)) throw new Error("Tool category is invalid"); if (!/^\d+\.\d+\.\d+/.test(tool.version)) throw new Error("Tool version must be semantic"); }
  private require(toolId: string): RegisteredTool { this.ensureReady(); const tool = this.tools.get(toolId); if (!tool) throw new Error(`Tool not found: ${toolId}`); return tool; }
  private ensureReady(): void { if (!this.initialized) throw new Error("Tool Manager is not initialized"); }
  private async restore(): Promise<void> { try { const saved = JSON.parse(await fs.readFile(path.join(this.root, "registry.json"), "utf8")) as RegisteredTool[]; for (const tool of saved) this.tools.set(tool.id, tool); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
  private async persist(): Promise<void> { const target = path.join(this.root, "registry.json"); const temporary = `${target}.${randomUUID()}.tmp`; await fs.writeFile(temporary, `${JSON.stringify(this.list(), null, 2)}\n`, "utf8"); await fs.rename(temporary, target); }
}