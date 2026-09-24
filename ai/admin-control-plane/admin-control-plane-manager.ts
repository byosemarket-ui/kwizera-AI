import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readJsonSafe, writeJsonAtomic } from "../../storage/safe-json.js";
import { maskCredential } from "./admin-auth-boundary.js";
import {
  createEmptyStore,
  createDefaultSettings,
  createDefaultFeatureMappings,
  createDefaultModels,
  createDefaultProviders,
} from "./defaults.js";
import { defaultKindForType, inferProviderKind } from "./provider-kind.js";
import { resolveFeatureExecution as executeFeatureResolution, type FeatureResolutionResult } from "./model-resolution.js";
import { credentialReferenceFor, type AdminCredentialManager } from "./credential-manager.js";
import { createCapabilityRuntime, type CapabilityRuntime } from "./capability-runtime.js";
import { createDefaultAdapterRegistry, isExecutableAdapter } from "./provider-adapters.js";
import { normalizeCostModel } from "./cost-model.js";
import {
  AdminValidationError,
  ADMIN_ERROR_CODES,
  requireNonEmpty,
  validateOptionalCost,
  validatePriority,
  validateTimeoutMs,
  validateModelCategory,
} from "./validation.js";
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
  private credentials: AdminCredentialManager | null = null;
  private readonly adapters = createDefaultAdapterRegistry();

  isInitialized(): boolean {
    return this.initialized;
  }

  attachCredentials(credentials: AdminCredentialManager): void {
    this.credentials = credentials;
  }

  /** Runtime-only credential manager — never serialize or return secrets via HTTP. */
  getCredentialManager(): AdminCredentialManager | null {
    return this.credentials;
  }

  /** Shared capability → provider → online adapter runtime. */
  getCapabilityRuntime(): CapabilityRuntime {
    this.requireInit();
    return createCapabilityRuntime(this, this.credentials);
  }

  async initialize(storageRoot: string, options?: { credentials?: AdminCredentialManager }): Promise<void> {
    if (options?.credentials) this.credentials = options.credentials;
    this.root = path.join(storageRoot, "admin-control-plane");
    this.storePath = path.join(this.root, "registry.json");
    await fs.mkdir(this.root, { recursive: true });
    const loaded = await readJsonSafe<AdminControlPlaneStore>(this.storePath, createEmptyStore());
    this.store = this.normalizeStore(loaded.value);
    if (loaded.recovered || !loaded.value?.version || loaded.value.version !== this.store.version) {
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

  /** Internal record — adapters may read this; HTTP must use getProvider(). */
  getProviderRecord(id: string): AdminProviderRecord | null {
    this.requireInit();
    const found = this.store.providers.find((p) => p.id === id);
    return found ? structuredClone(found) : null;
  }

  async upsertProvider(input: Partial<AdminProviderRecord> & { name: string; type: string }): Promise<AdminProviderPublicView> {
    this.requireInit();
    const t = now();
    const existing = input.id ? this.store.providers.find((p) => p.id === input.id) : undefined;
    const name = requireNonEmpty(String(input.name), "Provider name");
    const type = requireNonEmpty(String(input.type), "Provider type");
    const record: AdminProviderRecord = {
      id: existing?.id ?? input.id ?? `provider-${randomUUID()}`,
      name,
      type,
      kind: input.kind ?? existing?.kind ?? defaultKindForType(type),
      baseEndpoint: input.baseEndpoint?.trim() || existing?.baseEndpoint,
      credentialReference: input.credentialReference ?? existing?.credentialReference,
      credentialHint: input.credentialHint ?? existing?.credentialHint,
      status: input.status ?? existing?.status ?? "inactive",
      enabled: input.enabled ?? existing?.enabled ?? false,
      healthStatus: input.healthStatus ?? existing?.healthStatus ?? "unchecked",
      metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
      customerId: input.customerId ?? existing?.customerId,
      createdAt: existing?.createdAt ?? t,
      updatedAt: t,
    };
    this.store.providers = [
      ...this.store.providers.filter((p) => p.id !== record.id),
      record,
    ].sort((a, b) => a.name.localeCompare(b.name));
    this.store.updatedAt = t;
    await this.persist();
    return this.toProviderPublic(record);
  }

  /** Safe credential vault status — never includes secrets. */
  getCredentialVaultStatus(): { attached: boolean; unlocked: boolean } {
    return {
      attached: Boolean(this.credentials?.isAttached()),
      unlocked: Boolean(this.credentials?.isUnlocked()),
    };
  }

  async setProviderSecret(
    providerId: string,
    secret: string,
    options?: { enable?: boolean },
  ): Promise<AdminProviderPublicView> {
    this.requireInit();
    const provider = this.store.providers.find((p) => p.id === providerId);
    if (!provider) throw new AdminValidationError(ADMIN_ERROR_CODES.UNKNOWN_PROVIDER, `Provider not found: ${providerId}`);
    if (!this.credentials) {
      throw new AdminValidationError(
        ADMIN_ERROR_CODES.CREDENTIAL_LOCKED,
        "Credential vault is not attached. Set KWIZERA_SECRETS_PASSPHRASE and restart kwizera-ai.service",
      );
    }
    if (!this.credentials.isUnlocked()) {
      throw new AdminValidationError(
        ADMIN_ERROR_CODES.CREDENTIAL_LOCKED,
        "Credential vault is locked. Set KWIZERA_SECRETS_PASSPHRASE in /opt/kwizera-ai/.env and restart kwizera-ai.service",
      );
    }
    const stored = await this.credentials.setProviderSecret(providerId, secret);
    provider.credentialReference = credentialReferenceFor(providerId);
    provider.credentialHint = stored.hint;
    // Shared behavior for all external providers: persist enablement with credential save.
    const shouldEnable = options?.enable !== false && inferProviderKind(provider) === "EXTERNAL_API";
    if (shouldEnable) {
      provider.enabled = true;
      provider.status = "active";
    }
    provider.updatedAt = now();
    this.store.updatedAt = provider.updatedAt;
    await this.persist();
    return this.toProviderPublic(provider);
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
      throw new AdminValidationError(ADMIN_ERROR_CODES.UNKNOWN_PROVIDER, `Unknown providerId: ${input.providerId}`);
    }
    const name = requireNonEmpty(String(input.name), "Model name");
    const modelId = requireNonEmpty(String(input.modelId), "modelId");
    const t = now();
    const existing = input.id ? this.store.models.find((m) => m.id === input.id) : undefined;
    const duplicate = this.store.models.find(
      (m) => m.providerId === input.providerId && m.modelId === modelId && m.id !== (existing?.id ?? input.id),
    );
    if (duplicate) {
      throw new AdminValidationError(ADMIN_ERROR_CODES.DUPLICATE_MODEL, `Model ${modelId} already exists for this provider`);
    }
    this.validateModelRef(input.fallbackModelId);
    const category = validateModelCategory(String(input.category ?? existing?.category ?? ""));
    const timeoutMs = validateTimeoutMs(typeof input.timeoutMs === "number" ? input.timeoutMs : existing?.timeoutMs ?? 60_000);
    const priority = validatePriority(typeof input.priority === "number" ? input.priority : existing?.priority ?? 50);
    const estimatedCost = validateOptionalCost(input.estimatedCost ?? existing?.estimatedCost);
    const inputType = input.inputType ?? existing?.inputType ?? "any";
    const outputType = input.outputType ?? existing?.outputType ?? "any";
    const record: AdminModelRecord = {
      id: existing?.id ?? input.id ?? `model-${randomUUID()}`,
      name,
      providerId: input.providerId,
      category,
      capability: input.capability,
      modelId,
      endpoint: input.endpoint ?? existing?.endpoint,
      version: input.version ?? existing?.version,
      status: input.status ?? existing?.status ?? "inactive",
      priority,
      inputType,
      outputType,
      inputTypes: input.inputTypes ?? existing?.inputTypes ?? [inputType],
      outputTypes: input.outputTypes ?? existing?.outputTypes ?? [outputType],
      estimatedCost,
      currency: input.currency ?? existing?.currency ?? "USD",
      timeoutMs,
      enabled: input.enabled ?? existing?.enabled ?? false,
      fallbackModelId: input.fallbackModelId ?? existing?.fallbackModelId,
      costModel: normalizeCostModel(input.costModel ?? existing?.costModel, input.currency ?? existing?.currency ?? "USD"),
      metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
      customerId: input.customerId ?? existing?.customerId,
      projectId: input.projectId ?? existing?.projectId,
      createdAt: existing?.createdAt ?? t,
      updatedAt: t,
    };
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

  resolveFeatureExecution(feature: FeatureKey): FeatureResolutionResult {
    this.requireInit();
    return executeFeatureResolution(feature, {
      mapping: this.getFeatureMapping(feature),
      getModel: (id) => this.getModel(id),
      getProvider: (id) => this.store.providers.find((p) => p.id === id) ?? null,
      hasCredential: (providerId) => {
        if (this.credentials?.has(providerId)) return true;
        const provider = this.store.providers.find((p) => p.id === providerId);
        return Boolean(provider?.credentialReference || provider?.credentialHint);
      },
    });
  }

  async upsertFeatureMapping(input: Partial<FeatureMappingRecord> & { feature: FeatureKey; label: string }): Promise<FeatureMappingRecord> {
    this.requireInit();
    const t = now();
    const existing = this.store.featureMappings.find((f) => f.feature === input.feature || (input.id && f.id === input.id));
    this.validateModelRef(input.primaryModelId);
    this.validateModelRef(input.secondaryModelId);
    this.validateModelRef(input.fallbackModelId);
    if (input.providerId && !this.store.providers.some((p) => p.id === input.providerId)) {
      throw new AdminValidationError(ADMIN_ERROR_CODES.UNKNOWN_PROVIDER, `Unknown providerId: ${input.providerId}`);
    }
    const enabled = input.enabled ?? existing?.enabled ?? false;
    const primaryModelId = input.primaryModelId ?? existing?.primaryModelId;
    if (enabled && primaryModelId) {
      const primary = this.store.models.find((m) => m.id === primaryModelId);
      const providerId = input.providerId ?? existing?.providerId ?? primary?.providerId;
      const provider = providerId ? this.store.providers.find((p) => p.id === providerId) : undefined;
      if (provider && !provider.enabled) {
        throw new AdminValidationError(
          ADMIN_ERROR_CODES.PROVIDER_DISABLED,
          "Cannot enable a feature mapping whose primary provider is disabled",
        );
      }
    }
    const record: FeatureMappingRecord = {
      id: existing?.id ?? input.id ?? `feat-${randomUUID()}`,
      feature: input.feature,
      label: requireNonEmpty(String(input.label), "Feature label"),
      description: input.description ?? existing?.description ?? "",
      primaryModelId,
      secondaryModelId: input.secondaryModelId ?? existing?.secondaryModelId,
      fallbackModelId: input.fallbackModelId ?? existing?.fallbackModelId,
      providerId: input.providerId ?? existing?.providerId,
      enabled,
      priority: validatePriority(typeof input.priority === "number" ? input.priority : existing?.priority ?? 50),
      configuration: input.configuration ?? existing?.configuration,
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
    if (!setting) throw new AdminValidationError(ADMIN_ERROR_CODES.INVALID_SETTING, `Setting not found: ${key}`);
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

  async recordUsage(entry: Omit<AiUsageRecord, "id" | "timestamp" | "createdAt"> & {
    id?: string;
    timestamp?: string;
    createdAt?: string;
  }): Promise<AiUsageRecord> {
    this.requireInit();
    const stamp = entry.timestamp ?? entry.createdAt ?? now();
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
      inputReference: entry.inputReference,
      outputReference: entry.outputReference,
      durationMs: entry.durationMs,
      status: entry.status,
      estimatedCost: validateOptionalCost(entry.estimatedCost),
      actualCost: validateOptionalCost(entry.actualCost),
      currency: entry.currency || "USD",
      timestamp: stamp,
      createdAt: entry.createdAt ?? stamp,
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
    const { credentialReference, credentialHint, ...rest } = provider;
    const vault = this.getCredentialVaultStatus();
    const hasSecret = this.credentials?.has(provider.id) ?? false;
    // Authoritative: prefer live vault; fall back to persisted reference/hint only when vault is locked
    // (so CONFIGURED can still display after restart before passphrase unlock — without returning secrets).
    const hasCredential = hasSecret
      || Boolean(credentialReference)
      || Boolean(credentialHint);
    const hintSource = credentialHint ? `secret${credentialHint}` : credentialReference;
    const kind = inferProviderKind(provider);
    const adapter = this.adapters.resolve(provider);
    const adapterExecutable = Boolean(adapter && isExecutableAdapter(adapter));
    let connectionStatus: string;
    if (kind === "LOCAL") {
      connectionStatus = provider.enabled ? "LOCAL" : "DISABLED";
    } else if (!adapterExecutable) {
      connectionStatus = "NOT_IMPLEMENTED";
    } else if (!provider.enabled) {
      connectionStatus = "DISABLED";
    } else if (provider.healthStatus === "healthy") {
      connectionStatus = "CONNECTED";
    } else if (provider.healthStatus === "unhealthy") {
      connectionStatus = "AUTHENTICATION_FAILED";
    } else if (provider.healthStatus === "degraded") {
      connectionStatus = "PROVIDER_ERROR";
    } else {
      connectionStatus = "NOT_TESTED";
    }
    return {
      ...rest,
      kind,
      hasCredential,
      credentialMasked: hasCredential ? (credentialHint ? `••••••••${credentialHint}` : maskCredential(hintSource ?? "configured")) : null,
      configuredModelCount,
      credentialVaultAttached: vault.attached,
      credentialVaultUnlocked: vault.unlocked,
      adapterId: adapter?.id ?? null,
      adapterExecutable,
      connectionStatus,
    };
  }

  private validateModelRef(id?: string): void {
    if (!id) return;
    if (!this.store.models.some((m) => m.id === id)) {
      throw new AdminValidationError(ADMIN_ERROR_CODES.UNKNOWN_MODEL, `Unknown model id: ${id}`);
    }
  }

  private validateSettingValue(setting: TypedSetting, value: TypedSetting["value"]): void {
    if (value === null) return;
    const fail = (message: string) => {
      throw new AdminValidationError(ADMIN_ERROR_CODES.INVALID_SETTING, message);
    };
    switch (setting.valueType) {
      case "string":
        if (typeof value !== "string") fail(`Setting ${setting.key} expects string`);
        break;
      case "number":
        if (typeof value !== "number" || Number.isNaN(value)) fail(`Setting ${setting.key} expects number`);
        if (typeof setting.min === "number" && typeof value === "number" && value < setting.min) fail(`Setting ${setting.key} below min`);
        if (typeof setting.max === "number" && typeof value === "number" && value > setting.max) fail(`Setting ${setting.key} above max`);
        break;
      case "boolean":
        if (typeof value !== "boolean") fail(`Setting ${setting.key} expects boolean`);
        break;
      case "json":
        if (!isObject(value) && !Array.isArray(value)) fail(`Setting ${setting.key} expects json object`);
        break;
      default:
        break;
    }
  }

  private normalizeStore(raw: AdminControlPlaneStore): AdminControlPlaneStore {
    const empty = createEmptyStore();
    if (!raw || (raw.version !== 1 && raw.version !== 2)) return empty;

    const providerById = new Map(
      (Array.isArray(raw.providers) ? raw.providers : []).map((provider) => [
        provider.id,
        { ...provider, kind: inferProviderKind(provider) },
      ]),
    );
    for (const seed of createDefaultProviders()) {
      if (!providerById.has(seed.id)) {
        providerById.set(seed.id, { ...seed, kind: inferProviderKind(seed) });
      }
    }
    const providers = [...providerById.values()];

    const modelById = new Map(
      (Array.isArray(raw.models) ? raw.models : []).map((model) => [
        model.id,
        {
          ...model,
          inputTypes: model.inputTypes ?? [model.inputType],
          outputTypes: model.outputTypes ?? [model.outputType],
          costModel: normalizeCostModel(model.costModel, model.currency),
        },
      ]),
    );
    for (const seed of createDefaultModels()) {
      if (!modelById.has(seed.id)) {
        modelById.set(seed.id, {
          ...seed,
          inputTypes: seed.inputTypes ?? [seed.inputType],
          outputTypes: seed.outputTypes ?? [seed.outputType],
          costModel: normalizeCostModel(seed.costModel, seed.currency),
        });
      }
    }
    const models = [...modelById.values()];

    const existingFeatures = Array.isArray(raw.featureMappings) ? raw.featureMappings : [];
    const featureByKey = new Map(existingFeatures.map((item) => [item.feature, item]));
    for (const seed of createDefaultFeatureMappings()) {
      if (!featureByKey.has(seed.feature)) featureByKey.set(seed.feature, seed);
    }
    // Phase 2 additive migration: promote VISION_ANALYSIS to online OpenAI when still on seed Ollama-only mapping.
    const visionMapping = featureByKey.get("VISION_ANALYSIS");
    if (
      visionMapping
      && visionMapping.primaryModelId === "model-local-vision"
      && (visionMapping.providerId === "provider-ollama-local" || !visionMapping.providerId)
      && visionMapping.metadata?.phase2OnlineVision !== true
    ) {
      featureByKey.set("VISION_ANALYSIS", {
        ...visionMapping,
        primaryModelId: "model-openai-gpt-4o-mini",
        fallbackModelId: visionMapping.fallbackModelId || "model-local-vision",
        providerId: "provider-openai",
        metadata: {
          ...visionMapping.metadata,
          phase: "phase2-online-vision",
          phase2OnlineVision: true,
          migratedFrom: "model-local-vision",
        },
        updatedAt: now(),
      });
    }
    // Phase 3: ensure CREATIVE_REASONING exists (seed add) — already handled by featureByKey seed loop.
    // Promote CREATIVE_REASONING if an older custom row still points at Ollama-only without phase3 flag.
    const creativeMapping = featureByKey.get("CREATIVE_REASONING");
    if (
      creativeMapping
      && creativeMapping.primaryModelId === "model-local-llm"
      && (creativeMapping.providerId === "provider-ollama-local" || !creativeMapping.providerId)
      && creativeMapping.metadata?.phase3CreativeReasoning !== true
    ) {
      featureByKey.set("CREATIVE_REASONING", {
        ...creativeMapping,
        primaryModelId: "model-openai-gpt-4o-mini",
        fallbackModelId: creativeMapping.fallbackModelId || "model-local-llm",
        providerId: "provider-openai",
        metadata: {
          ...creativeMapping.metadata,
          phase: "phase3-creative-director",
          phase3CreativeReasoning: true,
          migratedFrom: "model-local-llm",
        },
        updatedAt: now(),
      });
    }
    const settingsByKey = new Map((Array.isArray(raw.settings) ? raw.settings : []).map((item) => [item.key, item]));
    for (const seed of createDefaultSettings()) {
      if (!settingsByKey.has(seed.key)) settingsByKey.set(seed.key, seed);
    }
    const usage = (Array.isArray(raw.usage) ? raw.usage : []).map((entry) => ({
      ...entry,
      createdAt: entry.createdAt ?? entry.timestamp,
    }));

    return {
      version: 2,
      providers: providers.length ? providers : empty.providers,
      models: models.length ? models : empty.models,
      featureMappings: [...featureByKey.values()],
      settings: [...settingsByKey.values()],
      usage,
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
