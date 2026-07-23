/**
 * KWIZERA AI STUDIO — AI Communication Bus types (Step 2H)
 */

export enum BusMessageType {
  Request = "request",
  Response = "response",
  Event = "event",
  Notification = "notification",
  Broadcast = "broadcast",
  HealthCheck = "health-check",
  StatusUpdate = "status-update",
  Error = "error",
  Recovery = "recovery",
  Validation = "validation",
}

export enum BusMessagePriority {
  Critical = "critical",
  High = "high",
  Normal = "normal",
  Low = "low",
  Background = "background",
}

export enum BusCommunicationState {
  Created = "created",
  Queued = "queued",
  Sending = "sending",
  Delivered = "delivered",
  Received = "received",
  Processing = "processing",
  Completed = "completed",
  Failed = "failed",
  Retrying = "retrying",
  Cancelled = "cancelled",
  Timeout = "timeout",
}

export interface BusMessagePayload {
  action?: string;
  data?: Record<string, unknown>;
}

export interface BusMessage {
  messageId: string;
  timestamp: string;
  sender: string;
  receiver: string;
  module: string;
  messageType: BusMessageType;
  priority: BusMessagePriority;
  payload: BusMessagePayload;
  status: BusCommunicationState;
  executionTimeMs: number;
  retryCount: number;
  correlationId: string;
  errors?: string[];
  result?: unknown;
}

export interface BusMessageInput {
  sender: string;
  receiver: string;
  module?: string;
  messageType: BusMessageType;
  priority?: BusMessagePriority;
  payload?: BusMessagePayload;
  correlationId?: string;
  handler?: (payload: BusMessagePayload | undefined) => Promise<unknown>;
}

export interface BusMessageResult {
  success: boolean;
  message: BusMessage;
  result?: unknown;
}

export interface BusChannelDefinition {
  channelId: string;
  moduleId: string;
  moduleName: string;
  supportedTypes: BusMessageType[];
  active: boolean;
}

export interface BusValidationResult {
  valid: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
  rejectionReason?: string;
}

export interface BusMessageHistoryRecord {
  messageId: string;
  sender: string;
  receiver: string;
  time: string;
  type: BusMessageType;
  priority: BusMessagePriority;
  result: string;
  errors: string[];
  retries: number;
  performanceMs: number;
  learningValue: number;
}

export interface BusPerformanceMetrics {
  routingSpeedMs: number;
  queueDepth: number;
  messageThroughput: number;
  averageLatencyMs: number;
  memoryUsageMb: number;
}

export interface BusStatusReport {
  communicationBusStatus: string;
  routingStatus: string;
  validationStatus: string;
  queuePerformance: string;
  recoveryStatus: string;
  performance: BusPerformanceMetrics;
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class CommunicationBusError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly messageId?: string
  ) {
    super(message);
    this.name = "CommunicationBusError";
  }
}

export const PRIORITY_ORDER: Record<BusMessagePriority, number> = {
  [BusMessagePriority.Critical]: 0,
  [BusMessagePriority.High]: 1,
  [BusMessagePriority.Normal]: 2,
  [BusMessagePriority.Low]: 3,
  [BusMessagePriority.Background]: 4,
};

export const SUPPORTED_MESSAGE_TYPES = Object.values(BusMessageType);
