import { describe, expect, it, beforeEach, vi } from "vitest";
import { CommandStack } from "../../../desktop/shell/ux/command-stack.ts";
import { ConfirmationService } from "../../../desktop/shell/ux/confirmation.ts";
import { getTooltip, formatTooltipText, explainToolForAiMe, listTooltips } from "../../../desktop/shell/ux/tooltip-registry.ts";
import { createField, validateField, validateForm, autofillSuggestion } from "../../../desktop/shell/ux/smart-forms.ts";
import { listProductivityActions, recordAction, toggleFavoriteAction } from "../../../desktop/shell/ux/productivity.ts";
import { trapFocus } from "../../../desktop/shell/ux/focus.ts";
import { buildAiMeUxContext } from "../../../desktop/shell/ux/aime-ux-awareness.ts";
import { KEYBOARD_SHORTCUTS } from "../../../desktop/shell/navigation/navigation-engine.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
}

describe("Undo / Redo", () => {
  it("supports multiple history levels", () => {
    let value = 0;
    const stack = new CommandStack();
    stack.execute({
      label: "inc",
      undo: () => { value -= 1; },
      redo: () => { value += 1; },
    });
    stack.execute({
      label: "inc",
      undo: () => { value -= 1; },
      redo: () => { value += 1; },
    });
    expect(value).toBe(2);
    expect(stack.undo()?.label).toBe("inc");
    expect(value).toBe(1);
    expect(stack.redo()?.label).toBe("inc");
    expect(value).toBe(2);
    expect(stack.depth().undo).toBe(2);
  });

  it("pushApplied does not re-run redo", () => {
    let value = 5;
    const stack = new CommandStack();
    stack.pushApplied({
      label: "layout",
      undo: () => { value = 0; },
      redo: () => { value = 5; },
    });
    expect(value).toBe(5);
    stack.undo();
    expect(value).toBe(0);
  });
});

describe("Confirmation System", () => {
  it("resolves confirm and cancel", async () => {
    const service = new ConfirmationService();
    const pending = service.ask({
      kind: "delete",
      title: "Delete item?",
      detail: "Cannot be undone.",
    });
    expect(service.getPending()?.title).toBe("Delete item?");
    service.resolve(true);
    await expect(pending).resolves.toEqual(expect.objectContaining({ confirmed: true }));
  });
});

describe("Tooltips", () => {
  it("explains purpose, usage, result, and related actions", () => {
    const tip = getTooltip("save");
    expect(tip?.purpose.toLowerCase()).toContain("persist");
    expect(formatTooltipText(tip!).toLowerCase()).toContain("result");
    expect(explainToolForAiMe("ai-me")).toContain("AI Me");
    expect(listTooltips().length).toBeGreaterThan(5);
  });
});

describe("Smart Forms", () => {
  it("validates required fields and suggestions", () => {
    let field = createField("name", "", true);
    field = validateField(field, { minLength: 2, suggestFrom: ["Nike Shoes", "Nike Bag"] });
    expect(field.error).toBe("Required");
    field = validateField({ ...field, value: "Ni" }, { minLength: 2, suggestFrom: ["Nike Shoes", "Nike Bag"] });
    expect(field.error).toBeNull();
    expect(field.suggestions[0]).toContain("Nike");
    const filled = autofillSuggestion(field, "Nike Shoes");
    expect(filled.value).toBe("Nike Shoes");
    expect(validateForm([filled]).valid).toBe(true);
  });
});

describe("Productivity & Shortcuts", () => {
  beforeEach(() => mockStorage());

  it("tracks recent and favorite actions", () => {
    recordAction("save");
    recordAction("save");
    recordAction("ai-me");
    toggleFavoriteAction("save");
    const list = listProductivityActions();
    expect(list.recent[0].id).toBe("ai-me");
    expect(list.favorites.some((a) => a.id === "save")).toBe(true);
    expect(list.frequent[0].id).toBe("save");
  });

  it("includes undo/redo in keyboard catalog", () => {
    expect(KEYBOARD_SHORTCUTS.some((s) => s.action === "undo")).toBe(true);
    expect(KEYBOARD_SHORTCUTS.some((s) => s.action === "redo")).toBe(true);
  });
});

describe("Accessibility Focus Trap", () => {
  it("registers keydown handler and returns cleanup", () => {
    const listeners: Array<[string, EventListener]> = [];
    const root = {
      querySelectorAll: () => [],
      addEventListener: (type: string, fn: EventListener) => { listeners.push([type, fn]); },
      removeEventListener: (type: string, fn: EventListener) => {
        const index = listeners.findIndex((entry) => entry[0] === type && entry[1] === fn);
        if (index >= 0) listeners.splice(index, 1);
      },
    } as unknown as HTMLElement;
    const release = trapFocus(root);
    expect(listeners.some((entry) => entry[0] === "keydown")).toBe(true);
    release();
    expect(listeners.length).toBe(0);
  });
});

describe("AI Me UX Awareness", () => {
  it("recommends productivity improvements", () => {
    const ctx = buildAiMeUxContext({
      version: 1,
      tooltipsEnabled: false,
      confirmDestructive: true,
      showKeyboardHints: true,
      tourCompleted: false,
      undoDepth: 0,
      redoDepth: 0,
      recentActions: [],
      favoriteActions: [],
      multiSelectCount: 0,
      focusMode: "keyboard",
    }, { highContrast: true, reducedMotion: false, fontScale: 110 }, null);
    expect(ctx.explanation.toLowerCase()).toContain("tooltip");
    expect(ctx.recommendation.length).toBeGreaterThan(0);
  });
});
