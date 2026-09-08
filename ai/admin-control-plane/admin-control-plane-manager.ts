import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readJsonSafe, writeJsonAtomic } from "../../storage/safe-json.js";
import { maskCredential } from "./admin-auth-boundary.js";
import { createEmptyStore } from "./defaults.js";
import type {
  AdminControlPlaneStore,
  AdminDashboardSnapshot,
  AdminModelRecord,
  AdminProviderPublicView,
  AdminProviderRecord,
  AiUsageRecord,
  FeatureMappingRecord,
  FeatureKey,
  TypedSetting,
  SettingCategory,
} from "./types.js";

function now(): string {
  return new Date().toISOString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class AdminControlPlaneManager {
  private root = "";
  private storePath = "";
  private store: AdminControlPlaneStore = createEmptyStore();
  private initialized = false;

  isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(storageRoot: string): Promise<void> {
    this.root = path.join(storageRoot, "admin-control-plane");
    this.storePath = path.join(this.root, "registry.json");
    await fs.mkdir(this.root, { recursive: true });
    const loaded = await readJsonSafe<AdminControlPlaneStore>(this.storePath, createEmptyStore());
    this.store = this.normalizeStore(loaded.value);
    if (loaded.recovered || !loaded.value?.version) {
      await this.persist();
    }
    this.initialized = true;
  }

  getStore(): AdminControlPlaneStore {
    this.requireInit();
    return structuredClone(this.store);
  }

  // ── Providers ──────────────────────────────────────────────

  listProviders(): AdminProviderPublicView[] {
    this.requireInit();
    return this.store.providers.map((p) => this.toProviderPublic(p));
  }

  getProvider(id: string): AdminProviderPublicView | null {
    this.requireInit();
    const found = this.store.providers.find((p) => p.id === id);
    return found ? this.toProviderPublic(found) : null;
  }

  async upsertProvider(input: Partial<AdminProviderRecord> & { name: string; type: string }): Promise<AdminProviderPublicView> {
    this.requireInit();
    const t = now();
    const existing = input.id ? this.store.providers.find((p) => p.id === input.id) : undefined;
    const record: AdminProviderRecord = {
      id: existing?.id ?? input.id ?? `provider-${randomUUID()}`,
      name: String(input.name).trim(),
      type: input.type,
      baseEndpoint: input.baseEndpoint?.trim() || existing?.baseEndpoint,
      credentialReference: input.credentialReference ?? existing?.credentialReference,
      status: input.status ?? existing?.status ?? "inactive",
      enabled: input.enabled ?? existing?.enabled ?? false,
      healthStatus: input.healthStatus ?? existing?.healthStatus ?? "unchecked",
      metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
      customerId: input.customerId ?? existing?.customerId,
      createdAt: existing?.createdAt ?? t,
      updatedAt: t,
    };
    if (!record.name) throw new Error("Provider name is required");
    this.store.providers = [
      ...this.store.providers.filter((p) => p.id !== record.id),
      record,
    ].sort((a, b) => a.name.localeCompare(b.name));
    this.store.updatedAt = t;
    await this.persist();
    return this.toProviderPublic(record);
  }

  async setProviderCredentialReference(providerId: string, credentialReference: string | undefined): Promise<AdminProviderPublicView> {
    this.requireInit();
    const provider = this.store.providers.find((p) => p.id === providerId);
    if (!provider) throw new Error(`Provider not found: ${providerId}`);
    provider.credentialReference = credentialReference?.trim() || undefined;
    provider.updatedAt = now();
    this.store.updatedAt = provider.updatedAt;
    await this.persist();
    return this.toProviderPublic(provider);
  }

  /** Resolve credential reference id only — never decrypt/return secret values here. */
  getProviderCredentialReference(providerId: string): string | undefined {
    this.requireInit();
    return this.store.providers.find((p) => p.id === providerId)?.credentialReference;
  }

  // ── Models ─────────────────────────────────────────────────

  listModels(filters?: {
    search?: string;
    category?: string;
    providerId?: string;
    capability?: string;
    enabled?: boolean;
    status?: string;
    page?: number;
    pageSize?: number;
  }): { items: AdminModelRecord[]; total: number; page: number; pageSize: number } {
    this.requireInit();
    const page = Math.max(1, filters?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters?.pageSize ?? 25));
    let items = [...this.store.models];

    const search = filters?.search?.trim().toLowerCase();
    if (search) {
      items = items.filter((m) =>
        [m.name, m.modelId, m.category, m.capability, m.providerId].join(" ").toLowerCase().includes(search),
      );
    }
    if (filters?.category) items = items.filter((m) => m.category === filters.category);
    if (filters?.providerId) items = items.filter((m) => m.providerId === filters.providerId);
    if (filters?.capability) items = items.filter((m) => m.capability === filters.capability);
    if (filters?.status) items = items.filter((m) => m.status === filters.status);
    if (typeof filters?.enabled === "boolean") items = items.filter((m) => m.enabled === filters.enabled);

    items.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  }

  getModel(id: string): AdminModelRecord | null {
    this.requireInit();
    return this.store.models.find((m) => m.id === id) ?? null;
  }

  async upsertModel(input: Partial<AdminModelRecord> & {
    name: string;
    providerId: string;
    category: AdminModelRecord["category"];
    capability: string;
    modelId: string;
  }): Promise<AdminModelRecord> {
    this.requireInit();
    if (!this.store.providers.some((p) => p.id === input.providerId)) {
      throw new Error(`Unknown providerId: ${input.providerId}`);
    }
    const t = now();
    const existing = input.id ? this.store.models.find((m) => m.id === input.id) : undefined;
    const record: AdminModelRecord = {
      id: existing?.id ?? input.id ?? `model-${randomUUID()}`,
      name: String(input.name).trim(),
      providerId: input.providerId,
      category: input.category,
      capability: input.capability,
      modelId: String(input.modelId).trim(),
      endpoint: input.endpoint ?? existing?.endpoint,
      version: input.version ?? existing?.version,
      status: input.status ?? existing?.status ?? "inactive",
      priority: typeof input.priority === "number" ? input.priority : existing?.priority ?? 50,
      inputType: input.inputType ?? existing?.inputType ?? "any",
      outputType: input.outputType ?? existing?.outputType ?? "any",
      estimatedCost: input.estimatedCost ?? existing?.estimatedCost,
      currency: input.currency ?? existing?.currency ?? "USD",
      timeoutMs: typeof input.timeoutMs === "number" ? input.timeoutMs : existing?.timeoutMs ?? 60_000,
      enabled: input.enabled ?? existing?.enabled ?? false,
      fallbackModelId: input.fallbackModelId ?? existing?.fallbackModelId,
      metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
      customerId: input.customerId ?? existing?.customerId,
      projectId: input.projectId ?? existing?.projectId,
      createdAt: existing?.createdAt ?? t,
      updatedAt: t,
    };
    if (!record.name || !record.modelId) throw new Error("Model name and modelId are required");
    this.store.models = [
      ...this.store.models.filter((m) => m.id !== record.id),
      record,
    ];
    this.store.updatedAt = t;
    await this.persist();
    return structuredClone(record);
  }

  async setModelEnabled(id: string, enabled: boolean): Promise<AdminModelRecord> {
    this.requireInit();
    const model = this.store.models.find((m) => m.id === id);
    if (!model) throw new Error(`Model not found: ${id}`);
    model.enabled = enabled;
    model.status = enabled ? "active" : "inactive";
    model.updatedAt = now();
    this.store.updatedAt = model.updatedAt;
    await this.persist();
    return structuredClone(model);
  }

  // ── Feature mapping ────────────────────────────────────────

  listFeatureMappings(): FeatureMappingRecord[] {
    this.requireInit();
    return structuredClone(this.store.featureMappings).sort((a, b) => b.priority - a.priority);
  }

  getFeatureMapping(feature: FeatureKey): FeatureMappingRecord | null {
    this.requireInit();
    return this.store.featureMappings.find((f) => f.feature === feature) ?? null;
  }

  /**
   * Resolve Feature → Model → Provider chain for runtime consumers.
   * Engines should call this instead of hardcoding providers/models.
   */
  resolveFeature(feature: FeatureKey): {
    feature: FeatureKey;
    mapping: FeatureMappingRecord | null;
    primaryModel: AdminModelRecord | null;
    secondaryModel: AdminModelRecord | null;
    fallbackModel: AdminModelRecord | null;
    provider: AdminProviderPublicView | null;
  } {
    this.requireInit();
    const mapping = this.getFeatureMapping(feature);
    const primaryModel = mapping?.primaryModelId ? this.getModel(mapping.primaryModelId) : null;
    const secondaryModel = mapping?.secondaryModelId ? this.getModel(mapping.secondaryModelId) : null;
    const fallbackModel = mapping?.fallbackModelId ? this.getModel(mapping.fallbackModelId) : null;
    const providerId = mapping?.providerId ?? primaryModel?.providerId;
    const provider = providerId ? this.getProvider(providerId) : null;
    return { feature, mapping, primaryModel, secondaryModel, fallbackModel, provider };
  }

  async upsertFeatureMapping(input: Partial<FeatureMappingRecord> & { feature: FeatureKey; label: string }): Promise<FeatureMappingRecord> {
    this.requireInit();
    const t = now();
    const existing = this.store.featureMappings.find((f) => f.feature === input.feature || (input.id && f.id === input.id));
    this.validateModelRef(input.primaryModelId);
    this.validateModelRef(input.secondaryModelId);
    this.validateModelRef(input.fallbackModelId);
    if (input.providerId && !this.store.providers.some((p) => p.id === input.providerId)) {
      throw new Error(`Unknown providerId: ${input.providerId}`);
    }
    const record: FeatureMappingRecord = {
      id: existing?.id ?? input.id ?? `feat-${randomUUID()}`,
      feature: input.feature,
      label: String(input.label).trim(),
      description: input.description ?? existing?.description ?? "",
      primaryModelId: input.primaryModelId ?? existing?.primaryModelId,
      secondaryModelId: input.secondaryModelId ?? existing?.secondaryModelId,
      fallbackModelId: input.fallbackModelId ?? existing?.fallbackModelId,
      providerId: input.providerId ?? existing?.providerId,
      enabled: input.enabled ?? existing?.enabled ?? false,
      priority: typeof input.priority === "number" ? input.priority : existing?.priority ?? 50,
      metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
      customerId: input.customerId ?? existing?.customerId,
      projectId: input.projectId ?? existing?.projectId,
      createdAt: existing?.createdAt ?? t,
      updatedAt: t,
    };
    this.store.featureMappings = [
      ...this.store.featureMappings.filter((f) => f.id !== record.id && f.feature !== record.feature),
      record,
    ];
    this.store.updatedAt = t;
    await this.persist();
    return structuredClone(record);
  }

  // ── Settings ───────────────────────────────────────────────

  listSettings(category?: SettingCategory): TypedSetting[] {
    this.requireInit();
    const items = structuredClone(this.store.settings);
    return category ? items.filter((s) => s.category === category) : items;
  }

  getSetting(key: string): TypedSetting | null {
    this.requireInit();
    return this.store.settings.find((s) => s.key === key) ?? null;
  }

  async updateSetting(key: string, value: TypedSetting["value"]): Promise<TypedSetting> {
    this.requireInit();
    const setting = this.store.settings.find((s) => s.key === key);
    if (!setting) throw new Error(`Setting not found: ${key}`);
    this.validateSettingValue(setting, value);
    setting.value = value;
    setting.updatedAt = now();
    this.store.updatedAt = setting.updatedAt;
    await this.persist();
    return structuredClone(setting);
  }

  // ── Usage contracts ────────────────────────────────────────

  listUsage(limit = 50): AiUsageRecord[] {
    this.requireInit();
    return structuredClone(this.store.usage)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, Math.min(200, Math.max(1, limit)));
  }

  async recordUsage(entry: Omit<AiUsageRecord, "id" | "timestamp"> & { id?: string; timestamp?: string }): Promise<AiUsageRecord> {
    this.requireInit();
    const record: AiUsageRecord = {
      id: entry.id ?? `usage-${randomUUID()}`,
      customerId: entry.customerId,
      projectId: entry.projectId,
      feature: entry.feature,
      modelId: entry.modelId,
      providerId: entry.providerId,
      operation: entry.operation,
      inputSummary: entry.inputSummary,
      outputSummary: entry.outputSummary,
      durationMs: entry.durationMs,
      status: entry.status,
      estimatedCost: entry.estimatedCost,
      actualCost: entry.actualCost,
      currency: entry.currency || "USD",
      timestamp: entry.timestamp ?? now(),
      metadata: entry.metadata ?? {},
    };
    this.store.usage.push(record);
    // Cap ledger growth in Stage 1
    if (this.store.usage.length > 5_000) {
      this.store.usage = this.store.usage.slice(-5_000);
    }
    this.store.updatedAt = now();
    await this.persist();
    return structuredClone(record);
  }

  // ── Dashboard ──────────────────────────────────────────────

  buildDashboard(hints?: {
    aiCoreOnline?: boolean;
    projectCount?: number | null;
    queueDepth?: number | null;
    storageOk?: boolean;
  }): AdminDashboardSnapshot {
    this.requireInit();
    const activeModels = this.store.models.filter((m) => m.enabled).length;
    const activeProviders = this.store.providers.filter((p) => p.enabled).length;
    const defaultModels = this.store.featureMappings
      .filter((f) => f.enabled)
      .map((f) => ({
        feature: f.feature,
        modelName: f.primaryModelId
          ? this.store.models.find((m) => m.id === f.primaryModelId)?.name ?? null
          : null,
      }));

    const na = "Not available yet";
    const projectCount = hints?.projectCount;
    const queueDepth = hints?.queueDepth;

    return {
      system: {
        systemStatus: "operational",
        aiStatus: hints?.aiCoreOnline === true ? "online" : hints?.aiCoreOnline === false ? "offline" : na,
        providerStatus: activeProviders > 0 ? `${activeProviders} enabled` : "none enabled",
        databaseStatus: "filesystem JSON store",
        storageStatus: hints?.storageOk === false ? "degraded" : hints?.storageOk === true ? "ok" : na,
        queueStatus: typeof queueDepth === "number" ? String(queueDepth) : na,
      },
      business: {
        totalCustomers: na,
        totalProjects: typeof projectCount === "number" ? projectCount : na,
        generatedVideos: na,
        generatedImages: na,
        generatedAudio: na,
        usage: this.store.usage.length > 0 ? this.store.usage.length : na,
      },
      ai: {
        activeModels,
        activeProviders,
        defaultModels,
        recentOperations: this.store.usage.length > 0 ? this.store.usage.length : na,
        failures: this.store.usage.filter((u) => u.status === "failed").length || na,
        latency: na,
      },
      cost: {
        today: na,
        period: na,
        estimated: na,
        providerUsage: na,
      },
      generatedAt: now(),
    };
  }

  private toProviderPublic(provider: AdminProviderRecord): AdminProviderPublicView {
    const configuredModelCount = this.store.models.filter((m) => m.providerId === provider.id).length;
    const { credentialReference, ...rest } = provider;
    return {
      ...rest,
      hasCredential: Boolean(credentialReference),
      credentialMasked: credentialReference ? maskCredential(credentialReference) : null,
      configuredModelCount,
    };
  }

  private validateModelRef(id?: string): void {
    if (!id) return;
    if (!this.store.models.some((m) => m.id === id)) {
      throw new Error(`Unknown model id: ${id}`);
    }
  }

  private validateSettingValue(setting: TypedSetting, value: TypedSetting["value"]): void {
    if (value === null) return;
    switch (setting.valueType) {
      case "string":
        if (typeof value !== "string") throw new Error(`Setting ${setting.key} expects string`);
        break;
      case "number":
        if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`Setting ${setting.key} expects number`);
        if (typeof setting.min === "number" && value < setting.min) throw new Error(`Setting ${setting.key} below min`);
        if (typeof setting.max === "number" && value > setting.max) throw new Error(`Setting ${setting.key} above max`);
        break;
      case "boolean":
        if (typeof value !== "boolean") throw new Error(`Setting ${setting.key} expects boolean`);
        break;
      case "json":
        if (!isObject(value) && !Array.isArray(value)) throw new Error(`Setting ${setting.key} expects json object`);
        break;
      default:
        break;
    }
  }

  private normalizeStore(raw: AdminControlPlaneStore): AdminControlPlaneStore {
    const empty = createEmptyStore();
    if (!raw || raw.version !== 1) return empty;
    return {
      version: 1,
      providers: Array.isArray(raw.providers) && raw.providers.length ? raw.providers : empty.providers,
      models: Array.isArray(raw.models) && raw.models.length ? raw.models : empty.models,
      featureMappings: Array.isArray(raw.featureMappings) && raw.featureMappings.length
        ? raw.featureMappings
        : empty.featureMappings,
      settings: Array.isArray(raw.settings) && raw.settings.length ? raw.settings : empty.settings,
      usage: Array.isArray(raw.usage) ? raw.usage : [],
      updatedAt: raw.updatedAt || now(),
    };
  }

  private async persist(): Promise<void> {
    await writeJsonAtomic(this.storePath, this.store);
  }

  private requireInit(): void {
    if (!this.initialized) throw new Error("Admin Control Plane is not initialized");
  }
}
