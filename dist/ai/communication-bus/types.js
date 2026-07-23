/**
 * KWIZERA AI STUDIO — AI Communication Bus types (Step 2H)
 */
export var BusMessageType;
(function (BusMessageType) {
    BusMessageType["Request"] = "request";
    BusMessageType["Response"] = "response";
    BusMessageType["Event"] = "event";
    BusMessageType["Notification"] = "notification";
    BusMessageType["Broadcast"] = "broadcast";
    BusMessageType["HealthCheck"] = "health-check";
    BusMessageType["StatusUpdate"] = "status-update";
    BusMessageType["Error"] = "error";
    BusMessageType["Recovery"] = "recovery";
    BusMessageType["Validation"] = "validation";
})(BusMessageType || (BusMessageType = {}));
export var BusMessagePriority;
(function (BusMessagePriority) {
    BusMessagePriority["Critical"] = "critical";
    BusMessagePriority["High"] = "high";
    BusMessagePriority["Normal"] = "normal";
    BusMessagePriority["Low"] = "low";
    BusMessagePriority["Background"] = "background";
})(BusMessagePriority || (BusMessagePriority = {}));
export var BusCommunicationState;
(function (BusCommunicationState) {
    BusCommunicationState["Created"] = "created";
    BusCommunicationState["Queued"] = "queued";
    BusCommunicationState["Sending"] = "sending";
    BusCommunicationState["Delivered"] = "delivered";
    BusCommunicationState["Received"] = "received";
    BusCommunicationState["Processing"] = "processing";
    BusCommunicationState["Completed"] = "completed";
    BusCommunicationState["Failed"] = "failed";
    BusCommunicationState["Retrying"] = "retrying";
    BusCommunicationState["Cancelled"] = "cancelled";
    BusCommunicationState["Timeout"] = "timeout";
})(BusCommunicationState || (BusCommunicationState = {}));
export class CommunicationBusError extends Error {
    code;
    messageId;
    constructor(message, code, messageId) {
        super(message);
        this.code = code;
        this.messageId = messageId;
        this.name = "CommunicationBusError";
    }
}
export const PRIORITY_ORDER = {
    [BusMessagePriority.Critical]: 0,
    [BusMessagePriority.High]: 1,
    [BusMessagePriority.Normal]: 2,
    [BusMessagePriority.Low]: 3,
    [BusMessagePriority.Background]: 4,
};
export const SUPPORTED_MESSAGE_TYPES = Object.values(BusMessageType);
//# sourceMappingURL=types.js.map