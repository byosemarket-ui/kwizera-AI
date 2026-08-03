import type { WorkspaceProfile } from "./types";

export const workspaceProfiles: WorkspaceProfile[] = [
  { id: "default", label: "Default Workspace", workspace: "dashboard", detail: "Balanced studio overview" },
  { id: "ai", label: "AI Workspace", workspace: "ai", detail: "Conversation and task context" },
  { id: "creative", label: "Creative Workspace", workspace: "editor", detail: "Scene, preview, and timeline focus" },
  { id: "marketing", label: "Marketing Workspace", workspace: "marketing", detail: "Campaign planning surface" },
  { id: "video", label: "Video Workspace", workspace: "video", detail: "Video production surface" },
  { id: "image", label: "Image Workspace", workspace: "image", detail: "Image production surface" },
  { id: "custom", label: "Custom Workspace", workspace: "projects", detail: "Personalized starting surface" },
];