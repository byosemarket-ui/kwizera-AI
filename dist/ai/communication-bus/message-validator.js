import { ManagedModuleState } from "../module-manager/types.js";
import { BusMessageType, SUPPORTED_MESSAGE_TYPES, } from "./types.js";
export class MessageValidator {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    validate(message) {
        const checks = [];
        const senderChannel = this.deps.channels.get(message.sender);
        const senderRecord = this.deps.resolveRecord(message.sender);
        checks.push({
            name: "sender-exists",
            passed: Boolean(senderChannel || senderRecord),
            message: senderChannel || senderRecord ? "Sender exists" : "Sender not found",
        });
        if (message.messageType === BusMessageType.Broadcast) {
            checks.push({
                name: "receiver-exists",
                passed: true,
                message: "Broadcast — receiver check skipped",
            });
        }
        else {
            const receiverChannel = this.deps.channels.get(message.receiver);
            const receiverRecord = this.deps.resolveRecord(message.receiver);
            checks.push({
                name: "receiver-exists",
                passed: Boolean(receiverChannel || receiverRecord),
                message: receiverChannel || receiverRecord ? "Receiver exists" : "Receiver not found",
            });
            const receiver = receiverRecord;
            const receiverActive = Boolean(receiver?.enabled) &&
                !this.deps.isIsolated(message.receiver) &&
                (receiver?.status === ManagedModuleState.Running ||
                    receiver?.status === ManagedModuleState.Ready ||
                    message.receiver === "health-monitor");
            checks.push({
                name: "receiver-active",
                passed: receiverActive || message.messageType === BusMessageType.Notification,
                message: receiverActive ? "Receiver active" : "Receiver inactive or isolated",
            });
        }
        const payloadValid = message.payload !== null &&
            message.payload !== undefined &&
            typeof message.payload === "object";
        checks.push({
            name: "payload-valid",
            passed: payloadValid,
            message: payloadValid ? "Payload valid" : "Payload invalid",
        });
        const typeSupported = SUPPORTED_MESSAGE_TYPES.includes(message.messageType);
        checks.push({
            name: "message-type-supported",
            passed: typeSupported,
            message: typeSupported ? "Message type supported" : "Unsupported message type",
        });
        const receiverRecord = this.deps.resolveRecord(message.receiver);
        if (receiverRecord?.dependencies?.length && message.messageType === BusMessageType.Request) {
            for (const dep of receiverRecord.dependencies) {
                if (dep === "ai-core")
                    continue;
                const available = this.deps.isDependencyAvailable(dep);
                checks.push({
                    name: `dependency:${dep}`,
                    passed: available,
                    message: available ? `${dep} available` : `${dep} unavailable`,
                });
            }
        }
        const failed = checks.filter((c) => !c.passed);
        return {
            valid: failed.length === 0,
            checks,
            rejectionReason: failed.length ? failed.map((f) => f.message).join("; ") : undefined,
        };
    }
}
//# sourceMappingURL=message-validator.js.map