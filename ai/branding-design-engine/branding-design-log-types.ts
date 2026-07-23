export type BrandingDesignLogLevel = "debug" | "info" | "warn" | "error";

export type BrandingDesignLogEvent =
  | "startup"
  | "branding-planning"
  | "design-planning"
  | "typography-planning"
  | "logo-planning"
  | "print-design"
  | "validation"
  | "recommendation"
  | "relationship"
  | "search"
  | "repair"
  | "performance";

export interface BrandingDesignLogEntry {
  timestamp: string;
  level: BrandingDesignLogLevel;
  event: BrandingDesignLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
