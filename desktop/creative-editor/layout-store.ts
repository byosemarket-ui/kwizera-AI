import type { EditingLayout } from "./types";

const KEY = "kwizera.creative-editor.layout.v1";
const defaults: EditingLayout = { leftWidth: 228, rightWidth: 276, leftOpen: true, rightOpen: true, timelineOpen: true };

export class EditingLayoutManager {
  load(): EditingLayout {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return defaults; }
  }
  save(layout: EditingLayout): void { localStorage.setItem(KEY, JSON.stringify(layout)); }
}