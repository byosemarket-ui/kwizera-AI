/**
 * Phase 8 — map existing error taxonomies (VideoProductionError codes, normalized provider codes,
 * storage errors) onto workflow failure classes with retry policy and subsystem routing.
 */
import type { ClassifiedFailure, FailureClass, FailureRoute, WorkflowStepId } from "./types.js";

/** Explicit failure raised by workflow executors. Message must already be customer-safe. */
export class WorkflowStepError extends Error {
  constructor(
    readonly failureClass: FailureClass,
    readonly code: string,
    customerMessage: string,
    readonly opts: { retryable?: boolean; waitingForUser?: boolean; route?: FailureRoute } = {},
  ) {
    super(customerMessage);
    this.name = "WorkflowStepError";
  }
}

const NEVER_RETRY: ReadonlySet<FailureClass> = new Set([
  "CONFIGURATION_ERROR",
  "AUTHENTICATION_ERROR",
  "USER_INPUT_ERROR",
  "QA_FAILURE",
]);

const STEP_ROUTE: Record<WorkflowStepId, FailureRoute> = {
  PRODUCT_INTELLIGENCE: "product_intelligence",
  PRODUCT_LOCK: "identity_lock",
  CREATIVE_PLANNING: "creative_planning",
  MEDIA_PREPARATION: "media_preparation",
  VIDEO_GENERATION: "video_generation",
  PRODUCT_3D_GENERATION: "video_generation",
  AUDIO: "audio",
  TIMELINE: "timeline",
  RENDER: "render",
  QA: "qa",
  REPAIR: "qa",
  DELIVERY: "delivery",
};

export function customerMessageFor(failureClass: FailureClass): string {
  switch (failureClass) {
    case "CONFIGURATION_ERROR":
    case "AUTHENTICATION_ERROR":
      return "This video style is unavailable right now. Choose Product Slideshow or try again later.";
    case "PROVIDER_ERROR":
    case "RATE_LIMIT":
    case "TIMEOUT":
      return "Video production is busy right now. Try again in a few minutes.";
    case "MEDIA_ERROR":
      return "One of your product images or media files could not be used. Check your media and try again.";
    case "INVALID_OUTPUT":
      return "A generated scene did not pass validation. Try again.";
    case "QA_FAILURE":
      return "Quality checks need your review before delivery.";
    case "USER_INPUT_ERROR":
      return "Some project details need your attention before production can continue.";
    case "STORAGE_ERROR":
      return "Your project could not be saved right now. Try again shortly.";
    default:
      return "Something went wrong while producing your video. Try again.";
  }
}

function build(
  failureClass: FailureClass,
  code: string,
  step: WorkflowStepId,
  opts: { retryable?: boolean; waitingForUser?: boolean; route?: FailureRoute; customerMessage?: string } = {},
): ClassifiedFailure {
  const retryable = NEVER_RETRY.has(failureClass) ? false : (opts.retryable ?? true);
  return {
    failureClass,
    code: code.replace(/[^A-Z0-9_]/g, "_").slice(0, 64) || "UNKNOWN",
    retryable,
    waitingForUser: opts.waitingForUser ?? (failureClass === "USER_INPUT_ERROR" || failureClass === "QA_FAILURE"),
    route: opts.route
      ?? (failureClass === "CONFIGURATION_ERROR" || failureClass === "AUTHENTICATION_ERROR"
        ? "admin_configuration"
        : failureClass === "USER_INPUT_ERROR" ? "customer_input" : STEP_ROUTE[step]),
    customerMessage: opts.customerMessage ?? customerMessageFor(failureClass),
  };
}

/** Provider-side detail embedded in an I2V/image failure message (message itself is never persisted). */
function classifyProviderText(text: string): FailureClass {
  if (/AUTHENTICATION|unauthori[sz]ed|forbidden|invalid[^a-z]*(api[^a-z]*)?key|\b401\b|\b403\b/i.test(text)) return "AUTHENTICATION_ERROR";
  if (/RATE[_ ]?LIMIT|too many requests|\b429\b/i.test(text)) return "RATE_LIMIT";
  if (/TIMEOUT|timed out/i.test(text)) return "TIMEOUT";
  if (/CONFIGURATION|not configured|MODEL_UNAVAILABLE|NOT_IMPLEMENTED/i.test(text)) return "CONFIGURATION_ERROR";
  return "PROVIDER_ERROR";
}

const VIDEO_CODE_MAP: Record<string, { cls: FailureClass; retryable?: boolean; waiting?: boolean; route?: FailureRoute }> = {
  PROJECT_NOT_FOUND: { cls: "USER_INPUT_ERROR", route: "customer_input" },
  MISSING_PLAN: { cls: "SYSTEM_ERROR", retryable: false, route: "creative_planning" },
  MISSING_ASSET: { cls: "MEDIA_ERROR", retryable: false, waiting: true, route: "customer_input" },
  INVALID_ASSET: { cls: "MEDIA_ERROR", retryable: false, waiting: true, route: "customer_input" },
  FFMPEG_UNAVAILABLE: { cls: "CONFIGURATION_ERROR" },
  FFPROBE_UNAVAILABLE: { cls: "CONFIGURATION_ERROR" },
  MISSING_TIMELINE: { cls: "SYSTEM_ERROR", route: "timeline" },
  VALIDATION_FAILED: { cls: "USER_INPUT_ERROR", route: "customer_input" },
  I2V_UNAVAILABLE: { cls: "CONFIGURATION_ERROR" },
  INVALID_RENDER_PLAN: { cls: "SYSTEM_ERROR", retryable: false, route: "timeline" },
  I2V_SCENE_INVALID: { cls: "INVALID_OUTPUT", route: "video_generation" },
  END_CARD_INVALID: { cls: "MEDIA_ERROR", route: "render" },
  AUDIO_MISSING: { cls: "USER_INPUT_ERROR", route: "audio" },
  VOICE_MISSING: { cls: "USER_INPUT_ERROR", route: "audio" },
  INVALID_OUTPUT: { cls: "INVALID_OUTPUT", route: "render" },
  REGISTRATION_FAILED: { cls: "STORAGE_ERROR", route: "render" },
  MISSING_OUTPUT: { cls: "INVALID_OUTPUT", route: "render" },
  FFMPEG_FAILED: { cls: "MEDIA_ERROR", route: "render" },
  RENDER_FAILED: { cls: "SYSTEM_ERROR", route: "render" },
  RESTART_INTERRUPTED: { cls: "SYSTEM_ERROR", route: "render" },
};

const PROVIDER_CODE_MAP: Record<string, { cls: FailureClass; retryable?: boolean }> = {
  AUTHENTICATION_FAILED: { cls: "AUTHENTICATION_ERROR" },
  PROVIDER_UNAVAILABLE: { cls: "PROVIDER_ERROR" },
  RATE_LIMITED: { cls: "RATE_LIMIT" },
  MODEL_UNAVAILABLE: { cls: "CONFIGURATION_ERROR" },
  INVALID_REQUEST: { cls: "CONFIGURATION_ERROR" },
  TIMEOUT: { cls: "TIMEOUT" },
  NETWORK_ERROR: { cls: "PROVIDER_ERROR" },
  CONFIGURATION_ERROR: { cls: "CONFIGURATION_ERROR" },
  NOT_IMPLEMENTED: { cls: "CONFIGURATION_ERROR" },
  UNKNOWN: { cls: "SYSTEM_ERROR" },
};

const STORAGE_ERRNO = new Set(["ENOSPC", "EACCES", "EROFS", "EPERM", "EMFILE", "EIO"]);

/**
 * Classify a render job failure recorded by VideoProductionManager (errorCode + message).
 * The raw message is inspected only for classification and is never stored.
 */
export function classifyRenderJobFailure(
  errorCode: string | undefined,
  message: string | undefined,
  step: WorkflowStepId,
): ClassifiedFailure {
  const code = (errorCode ?? "RENDER_FAILED").toUpperCase();
  if (code === "I2V_SCENE_FAILED") {
    const cls = classifyProviderText(message ?? "");
    return build(cls, code, step, { route: cls === "AUTHENTICATION_ERROR" || cls === "CONFIGURATION_ERROR" ? "admin_configuration" : "video_generation" });
  }
  const mapped = VIDEO_CODE_MAP[code];
  if (mapped) {
    return build(mapped.cls, code, step, { retryable: mapped.retryable, waitingForUser: mapped.waiting, route: mapped.route });
  }
  return build("SYSTEM_ERROR", code, step);
}

export function classifyWorkflowError(error: unknown, step: WorkflowStepId): ClassifiedFailure {
  if (error instanceof WorkflowStepError) {
    return build(error.failureClass, error.code, step, {
      retryable: error.opts.retryable,
      waitingForUser: error.opts.waitingForUser,
      route: error.opts.route,
      customerMessage: error.message,
    });
  }
  const e = error as { name?: string; code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : "";
  const message = typeof e?.message === "string" ? e.message : "";
  if (e?.name === "VideoProductionError" && code) {
    return classifyRenderJobFailure(code, message, step);
  }
  if (e?.name === "ProviderRuntimeError" && code) {
    const mapped = PROVIDER_CODE_MAP[code] ?? PROVIDER_CODE_MAP.UNKNOWN!;
    return build(mapped.cls, code, step, { retryable: mapped.retryable });
  }
  if (code && STORAGE_ERRNO.has(code)) {
    return build("STORAGE_ERROR", code, step, { retryable: code !== "ENOSPC" && code !== "EROFS" });
  }
  if (/timed out|timeout/i.test(message)) return build("TIMEOUT", "TIMEOUT", step);
  return build("SYSTEM_ERROR", "UNEXPECTED_ERROR", step);
}

/** Delay before the next retry; rate limits back off harder. */
export function retryDelayMs(failure: ClassifiedFailure, attempt: number): number {
  const base = failure.failureClass === "RATE_LIMIT" ? 10_000 : 2_000;
  return Math.min(60_000, base * Math.max(1, attempt));
}
