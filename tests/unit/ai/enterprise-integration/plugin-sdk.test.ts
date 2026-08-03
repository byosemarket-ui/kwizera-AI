import { describe, expect, it } from "vitest";
import { defineEnterpriseExtension } from "../../../../ai/enterprise-integration/plugin-sdk.js";

describe("enterprise integration SDK", () => {
  it("requires an extension capability and preserves connector contracts for trusted installation", () => {
    expect(() => defineEnterpriseExtension({})).toThrow("at least one capability");
    expect(defineEnterpriseExtension({
      connector: {
        id: "example.erp", name: "Example ERP", description: "Provider-neutral ERP connector", version: "1.0.0", provider: "Example", category: "business",
        authentication: { type: "personal-access-token", secretId: "example-token" }, endpoint: { baseUrl: "https://api.example.test", allowedPaths: ["/v1/"] }, requiredPermissions: ["integrations.erp.read"], retryPolicy: { maxAttempts: 2, initialDelayMs: 10, maxDelayMs: 20, retryStatusCodes: [503] }, timeoutMs: 1000,
      },
    }).connector?.authentication.type).toBe("personal-access-token");
  });
});