/**
 * Customer Service Workspace — shared types and state machine.
 * Engines stay in existing Studio modules; this layer is customer chrome + routing.
 */

export type ServiceWorkspacePhase =
  | "idle"
  | "input"
  | "processing"
  | "preview"
  | "saving"
  | "complete"
  | "error";

export type ServiceWorkspaceStepId = string;

export interface ServiceWorkspaceStep {
  id: ServiceWorkspaceStepId;
  label: string;
  description?: string;
}

export interface ServiceWorkspaceMeta {
  serviceKey: string;
  title: string;
  description: string;
  helpHint?: string;
}

export const VIDEO_SERVICE_STEPS: ServiceWorkspaceStep[] = [
  { id: "upload", label: "Product", description: "Images and product details" },
  { id: "plan", label: "Intelligence", description: "Analyze and lock product identity" },
  { id: "style", label: "Creative", description: "Ad plan and generation" },
  { id: "create", label: "Produce", description: "Audio, timeline, render" },
  { id: "preview", label: "Deliver", description: "QA and export" },
];

export const IMAGE_SERVICE_STEPS: ServiceWorkspaceStep[] = [
  { id: "select", label: "Select", description: "Choose or upload a photo" },
  { id: "edit", label: "Edit", description: "Analyze and prepare" },
  { id: "preview", label: "Preview", description: "Review results" },
  { id: "save", label: "Save", description: "Keep your work" },
];

export const PASSPORT_SERVICE_STEPS: ServiceWorkspaceStep[] = [
  { id: "capture", label: "Photo", description: "Upload or take a photo" },
  { id: "crop", label: "Crop", description: "Position and crop" },
  { id: "background", label: "Background", description: "Clean background" },
  { id: "format", label: "Format", description: "Size and compliance" },
  { id: "export", label: "Export", description: "Save and download" },
];

export const DESIGN_SERVICE_STEPS: ServiceWorkspaceStep[] = [
  { id: "choose", label: "Choose", description: "Pick a design type" },
  { id: "edit", label: "Design", description: "Edit your design" },
  { id: "preview", label: "Preview", description: "Review" },
  { id: "export", label: "Export", description: "Save and download" },
];

export const AUDIO_SERVICE_STEPS: ServiceWorkspaceStep[] = [
  { id: "choose", label: "Choose", description: "Pick an audio tool" },
  { id: "create", label: "Create", description: "Generate or edit" },
  { id: "preview", label: "Preview", description: "Listen and refine" },
  { id: "export", label: "Export", description: "Save and download" },
];

export const DESIGN_TYPE_CATALOG = [
  "Flyer", "Poster", "Banner", "Business Card", "Invitation", "Save the Date",
  "Wedding", "Birthday", "Certificate", "Menu", "Product Label",
  "Social Media Post", "Advertisement", "Billboard",
] as const;

export const AUDIO_TYPE_CATALOG = [
  "Music", "Voice-over", "Text-to-Speech", "Speech-to-Text", "Audio Editing",
] as const;
