import type { StudioModuleId } from "./types.js";

export const STUDIO_MODULE_CATALOG: Array<{
  moduleId: StudioModuleId;
  displayName: string;
  version: string;
}> = [
  { moduleId: "knowledge-foundation", displayName: "Knowledge Foundation", version: "1.0" },
  { moduleId: "ai-me", displayName: "AI Me", version: "1.0" },
  { moduleId: "product-intelligence", displayName: "Product Intelligence", version: "1.0" },
  { moduleId: "storyboard-engine", displayName: "Storyboard Engine", version: "1.0" },
  { moduleId: "prompt-engine", displayName: "Prompt Engine", version: "1.0" },
  { moduleId: "image-generation", displayName: "Image Generation", version: "1.0" },
  { moduleId: "video-generation", displayName: "Video Generation", version: "1.0" },
  { moduleId: "audio-generation", displayName: "Audio Generation", version: "1.0" },
  { moduleId: "rendering", displayName: "Rendering", version: "1.0" },
  { moduleId: "learning-engine", displayName: "Learning Engine", version: "1.0" },
  { moduleId: "asset-library", displayName: "Asset Library", version: "1.0" },
  { moduleId: "workspace", displayName: "Workspace", version: "1.0" },
  { moduleId: "project-manager", displayName: "Project Manager", version: "1.0" },
];

export const OUTPUT_FOLDERS = [
  "generated-images",
  "generated-videos",
  "audio-files",
  "exports",
  "thumbnails",
  "previews",
  "logs",
  "reports",
  "temporary-outputs",
] as const;

export const WORKSPACE_FOLDERS = [
  "active",
  "temporary",
  "cache",
  "export",
  "backup",
] as const;
