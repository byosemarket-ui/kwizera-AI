/**
 * Phase 36 — ForexConnect DEMO/LIVE session orchestration.
 * Single active SDK session; credentials never cross environments.
 */
import { getForexConnectBridge, type ForexConnectBridge } from "./client.js";
import {
  getForexConnectProfilesManager,
  parseUiEnvironment,
  uiEnvToSdk,
  type ForexConnectProfilesManager,
  type ForexConnectUiEnvironment,
} from "./profiles.js";
import {
  getForexConnectLiveCandleService,
  type ForexConnectLiveCandleService,
} from "./live-service.js";
import type { ForexConnectSafeStatus } from "./types.js";

export interface ForexConnectSessionActionResult {
  ok: boolean;
  environment: ForexConnectUiEnvironment;
  label: "DEMO" | "LIVE";
  status: ForexConnectSafeStatus;
  profiles: Awaited<ReturnType<ForexConnectProfilesManager["publicState"]>>;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  error?: { code: string; message: string };
}

function labelOf(env: ForexConnectUiEnvironment): "DEMO" | "LIVE" {
  return env === "live" ? "LIVE" : "DEMO";
}

function switchMessage(from: ForexConnectUiEnvironment, to: ForexConnectUiEnvironment): string {
  return `Switch ForexConnect from ${labelOf(from)} to ${labelOf(to)}? `
    + `This will disconnect the current session and activate the selected ${labelOf(to)} profile. `
    + "Trading execution remains disabled.";
}

export class ForexConnectSessionService {
  constructor(
    private readonly profiles: ForexConnectProfilesManager,
    private readonly bridge: ForexConnectBridge,
    private readonly live: ForexConnectLiveCandleService,
  ) {}

  async getProfilesState() {
    return this.profiles.publicState();
  }

  async saveCredentials(
    envRaw: unknown,
    input: { username: string; password: string },
  ) {
    const env = parseUiEnvironment(envRaw);
    if (!env) {
      throw new Error("environment must be demo or live");
    }
    const profile = await this.profiles.saveCredentials(env, input);
    return {
      ok: true as const,
      profile,
      profiles: this.profiles.publicState(),
      note: "Credentials saved. Password is never returned.",
    };
  }

  async testConnection(
    envRaw: unknown,
    options?: { confirmSwitch?: boolean },
  ): Promise<ForexConnectSessionActionResult> {
    const env = parseUiEnvironment(envRaw);
    if (!env) {
      return this.fail(null, "INVALID_ENVIRONMENT", "environment must be demo or live");
    }
    return this.connectProfile(env, {
      activate: false,
      confirmSwitch: Boolean(options?.confirmSwitch),
    });
  }

  async activate(
    envRaw: unknown,
    options?: { confirmSwitch?: boolean },
  ): Promise<ForexConnectSessionActionResult> {
    const env = parseUiEnvironment(envRaw);
    if (!env) {
      return this.fail(null, "INVALID_ENVIRONMENT", "environment must be demo or live");
    }
    return this.connectProfile(env, {
      activate: true,
      confirmSwitch: Boolean(options?.confirmSwitch),
    });
  }

  async disconnect(): Promise<ForexConnectSessionActionResult> {
    await this.live.clearAllSessions();
    const status = await this.bridge.disconnect();
    const previous = this.profiles.getActiveEnvironment();
    this.profiles.setActiveSession(null, status.status);
    return {
      ok: true,
      environment: previous ?? "demo",
      label: labelOf(previous ?? "demo"),
      status,
      profiles: this.profiles.publicState(),
    };
  }

  async discoverInstruments(envRaw: unknown) {
    const env = parseUiEnvironment(envRaw);
    if (!env) {
      return {
        ok: false as const,
        error: { code: "INVALID_ENVIRONMENT", message: "environment must be demo or live" },
      };
    }
    const active = this.profiles.getActiveEnvironment();
    const status = await this.bridge.getStatus();
    if (status.status !== "CONNECTED") {
      return {
        ok: false as const,
        error: {
          code: String(status.errorCode ?? "FOREXCONNECT_NOT_CONNECTED"),
          message: status.errorMessage ?? "Connect before discovering instruments.",
        },
        status,
        profiles: this.profiles.publicState(),
      };
    }
    if (active && active !== env) {
      return {
        ok: false as const,
        error: {
          code: "ENVIRONMENT_MISMATCH",
          message: `Active session is ${labelOf(active)}; cannot discover ${labelOf(env)} instruments.`,
        },
        status,
        profiles: this.profiles.publicState(),
      };
    }
    const expectedSdk = uiEnvToSdk(env);
    if (status.environment && status.environment !== expectedSdk) {
      return {
        ok: false as const,
        error: {
          code: "ENVIRONMENT_MISMATCH",
          message: `Session environment is ${status.environmentLabel}; expected ${labelOf(env)}.`,
        },
        status,
        profiles: this.profiles.publicState(),
      };
    }
    const result = await this.bridge.listInstruments();
    if (result.ok) {
      await this.profiles.recordAuthResult(env, {
        status: "INSTRUMENTS_READY",
        instrumentCount: result.count,
        instrumentAt: result.fetchedAt ?? new Date().toISOString(),
        connectedAt: status.connectedAt,
      });
    }
    return {
      ...result,
      environment: env,
      label: labelOf(env),
      profiles: this.profiles.publicState(),
    };
  }

  private async connectProfile(
    env: ForexConnectUiEnvironment,
    options: { activate: boolean; confirmSwitch: boolean },
  ): Promise<ForexConnectSessionActionResult> {
    const creds = this.profiles.getCredentials(env);
    if (!creds) {
      await this.profiles.recordAuthResult(env, {
        status: "NOT_CONFIGURED",
        errorMessage: "Save username and password for this environment first.",
      });
      const status = await this.bridge.getStatus();
      return {
        ok: false,
        environment: env,
        label: labelOf(env),
        status: {
          ...status,
          status: "NOT_CONFIGURED",
          errorCode: "FOREXCONNECT_NOT_CONFIGURED",
          errorMessage: "Save username and password for this environment first.",
        },
        profiles: this.profiles.publicState(),
        error: {
          code: "NOT_CONFIGURED",
          message: "Save username and password for this environment first.",
        },
      };
    }

    const active = this.profiles.getActiveEnvironment();
    const currentStatus = await this.bridge.getStatus();
    const switching = Boolean(
      active
      && active !== env
      && currentStatus.status === "CONNECTED",
    );
    if (switching && !options.confirmSwitch) {
      return {
        ok: false,
        environment: env,
        label: labelOf(env),
        status: currentStatus,
        profiles: this.profiles.publicState(),
        requiresConfirmation: true,
        confirmationMessage: switchMessage(active!, env),
        error: {
          code: "CONFIRM_SWITCH_REQUIRED",
          message: switchMessage(active!, env),
        },
      };
    }

    if (currentStatus.status === "CONNECTED") {
      await this.live.clearAllSessions();
      await this.bridge.disconnect();
      // Do not publish the new environment as active until auth succeeds.
      this.profiles.setActiveSession(null, "DISCONNECTED");
    }

    const status = await this.bridge.connect({
      username: creds.username,
      password: creds.password,
      environment: creds.sdkEnvironment,
    });

    await this.profiles.recordAuthResult(env, {
      status: status.status,
      errorMessage: status.errorMessage,
      instrumentCount: status.instrumentCount,
      connectedAt: status.connectedAt,
      instrumentAt: status.lastInstrumentAt,
    });

    if (status.status === "CONNECTED") {
      this.profiles.setActiveSession(env, status.status);
      if (options.activate) {
        await this.profiles.persistPreferred(env);
      }
      return {
        ok: true,
        environment: env,
        label: labelOf(env),
        status,
        profiles: this.profiles.publicState(),
      };
    }

    // Auth failed — never claim the new environment is active.
    this.profiles.setActiveSession(null, status.status);
    return {
      ok: false,
      environment: env,
      label: labelOf(env),
      status,
      profiles: this.profiles.publicState(),
      error: {
        code: String(status.errorCode ?? status.status),
        message: status.errorMessage ?? `Authentication failed for ${labelOf(env)}.`,
      },
    };
  }

  private fail(
    env: ForexConnectUiEnvironment | null,
    code: string,
    message: string,
  ): ForexConnectSessionActionResult {
    const environment = env ?? "demo";
    return {
      ok: false,
      environment,
      label: labelOf(environment),
      status: {
        ok: false,
        provider: "FOREXCONNECT",
        apiPath: "FXCM ForexConnect SDK (sidecar)",
        status: code,
        enabled: false,
        configured: false,
        environment: uiEnvToSdk(environment),
        environmentLabel: environment === "live" ? "FXCM REAL" : "FXCM DEMO",
        urlHost: "",
        usernameConfigured: false,
        passwordConfigured: false,
        trading: "DISABLED",
        sidecarReachable: false,
        errorCode: code,
        errorMessage: message,
        instrumentCount: 0,
        connectedAt: null,
        lastInstrumentAt: null,
        historicalCapable: false,
        supportedTimeframes: [],
        lastHistoricalAt: null,
        priceBasis: "bid",
        connecting: false,
        checkedAt: new Date().toISOString(),
      },
      profiles: this.profiles.publicState(),
      error: { code, message },
    };
  }
}

let singleton: ForexConnectSessionService | null = null;

export async function getForexConnectSessionService(): Promise<ForexConnectSessionService> {
  if (!singleton) {
    const profiles = await getForexConnectProfilesManager();
    singleton = new ForexConnectSessionService(
      profiles,
      getForexConnectBridge(),
      getForexConnectLiveCandleService(),
    );
  }
  return singleton;
}

export function createForexConnectSessionService(deps: {
  profiles: ForexConnectProfilesManager;
  bridge: ForexConnectBridge;
  live: ForexConnectLiveCandleService;
}): ForexConnectSessionService {
  return new ForexConnectSessionService(deps.profiles, deps.bridge, deps.live);
}

export function resetForexConnectSessionServiceForTests(): void {
  singleton = null;
}
