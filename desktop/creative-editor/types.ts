export interface EditorScene {
  id: string;
  title: string;
  duration: number;
  status: "ready" | "draft" | "waiting";
  description: string;
}

export interface EditorLayer {
  id: string;
  name: string;
  kind: "product" | "background" | "text" | "logo" | "effects" | "camera" | "audio";
  visible: boolean;
  locked: boolean;
}

export interface EditingLayout {
  leftWidth: number;
  rightWidth: number;
  leftOpen: boolean;
  rightOpen: boolean;
  timelineOpen: boolean;
}

export interface EditingStatus {
  aiCore: boolean;
  workflowEngine: boolean;
  communicationBus: boolean;
  memoryFoundation: boolean;
  knowledgeFoundation: boolean;
  productIntelligence: boolean;
  cameraSimulation: boolean;
  activeProject: string;
}