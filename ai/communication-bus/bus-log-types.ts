export type CommunicationBusLogLevel = "debug" | "info" | "warn" | "error";

export type CommunicationBusLogEvent =
  | "request"
  | "response"
  | "broadcast"
  | "error"
  | "warning"
  | "retry"
  | "timeout"
  | "recovery"
  | "validation";

export interface CommunicationBusLogEntry {
  timestamp: string;
  level: CommunicationBusLogLevel;
  event: CommunicationBusLogEvent;
  message: string;
  data?: Record<string, unknown>;
}
