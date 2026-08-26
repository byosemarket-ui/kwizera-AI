/**
 * Product Creation workflow binding unit tests (localStorage + helpers).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pickStoreForProject,
  prerequisiteBlockReason,
  readScopedHandoff,
  writeScopedHandoff,
} from "../desktop/product-creation/workflow";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
}

describe("Product Creation workflow helpers", () => {
  beforeEach(() => mockStorage());

  it("scopes handoffs by projectId and does not leak across projects", () => {
    writeScopedHandoff("test.handoff", {
      version: 1,
      projectId: "proj-a",
      step: "step-2-image-organization",
      mark: "A",
    } as { version: 1; projectId: string; step: string; mark: string });
    writeScopedHandoff("test.handoff", {
      version: 1,
      projectId: "proj-b",
      step: "step-2-image-organization",
      mark: "B",
    } as { version: 1; projectId: string; step: string; mark: string });

    expect(readScopedHandoff<{ mark: string }>("test.handoff", "proj-a")?.mark).toBe("A");
    expect(readScopedHandoff<{ mark: string }>("test.handoff", "proj-b")?.mark).toBe("B");
    expect(readScopedHandoff("test.handoff", "proj-c")).toBeNull();
  });

  it("never picks an arbitrary first store entry", () => {
    const map = { "p1": { id: 1 }, "p2": { id: 2 } };
    expect(pickStoreForProject(map, "p2")).toEqual({ id: 2 });
    expect(pickStoreForProject(map, null)).toBeNull();
    expect(pickStoreForProject(map, "missing")).toBeNull();
  });

  it("blocks later steps without images", () => {
    const empty = {
      id: "x",
      name: "X",
      createdAt: "",
      modifiedAt: "",
      productImages: [],
      productInformation: { name: "", category: "", description: "" },
    } as never;
    expect(prerequisiteBlockReason(2, empty)).toMatch(/image/i);
    expect(prerequisiteBlockReason(1, empty)).toBeNull();
  });
});
