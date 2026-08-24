import type { WorkspaceProfile } from "./types";

export const workspaceProfiles: WorkspaceProfile[] = [
  { id: "default", label: "Default Workspace", workspace: "home", detail: "Balanced studio overview", layoutId: "default" },
  { id: "ai", label: "AI Workspace", workspace: "ai-me", detail: "Conversation and task context", layoutId: "default" },
  { id: "creative", label: "Creative Workspace", workspace: "storyboard", detail: "Scene, preview, and timeline focus", layoutId: "creative" },
  { id: "marketing", label: "Marketing Workspace", workspace: "marketing", detail: "Campaign planning surface", layoutId: "default" },
  { id: "video", label: "Video Workspace", workspace: "generated-videos", detail: "Video production surface", layoutId: "production" },
  { id: "image", label: "Image Workspace", workspace: "generated-images", detail: "Image production surface", layoutId: "creative" },
  { id: "custom", label: "Custom Workspace", workspace: "open-project", detail: "Personalized starting surface", layoutId: null },
];
