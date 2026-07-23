export class ErrorAnalyzer {
    analyze(input) {
        const rootCause = this.inferRootCause(input);
        const recoveryOptions = this.generateRecoveryOptions(input);
        const safest = recoveryOptions.find((o) => o.safety === "safest") ?? recoveryOptions[0];
        return {
            rootCause,
            recoveryOptions,
            safestOptionId: safest.id,
            explanation: `Root cause: ${rootCause}. Safest recovery: ${safest.label}`,
        };
    }
    inferRootCause(input) {
        const msg = input.errorMessage.toLowerCase();
        if (msg.includes("missing") || msg.includes("required")) {
            return "Required input or dependency not satisfied";
        }
        if (msg.includes("timeout") || msg.includes("network")) {
            return "External resource or timeout failure";
        }
        if (msg.includes("validation") || msg.includes("invalid")) {
            return "Validation or data format failure";
        }
        if (input.stage) {
            return `Failure during stage: ${input.stage}`;
        }
        return input.errorMessage;
    }
    generateRecoveryOptions(input) {
        return [
            {
                id: "recovery-retry-safe",
                label: "Safe retry with validation",
                description: "Re-validate inputs and retry with conservative settings",
                safety: "safest",
            },
            {
                id: "recovery-collect-info",
                label: "Collect missing information",
                description: "Pause and gather required data before retrying",
                safety: "safest",
            },
            {
                id: "recovery-alternate-path",
                label: "Alternate workflow path",
                description: "Use a reduced-scope workflow to avoid the failure point",
                safety: "moderate",
            },
            {
                id: "recovery-force-retry",
                label: "Force immediate retry",
                description: "Retry without changes — higher risk of repeated failure",
                safety: "aggressive",
            },
        ];
    }
}
//# sourceMappingURL=error-analyzer.js.map