import type { ReactNode } from "react";
import {
  BarChart3, BookOpen, FileAudio, FileImage,
  Library, Settings, Sparkles,
} from "lucide-react";
import { ProfessionalDashboard } from "../dashboard/ProfessionalDashboard";
import { ProjectWorkspace } from "../project-workspace/ProjectWorkspace";
import { AiStudioWorkspace } from "../ai-studio/AiStudioWorkspace";
import { CreativeEditingWorkspace } from "../creative-editor/CreativeEditingWorkspace";
import { BusinessIntelligenceWorkspace } from "../business-intelligence/BusinessIntelligenceWorkspace";
import { MarketingInputWorkspace } from "../marketing-input/MarketingInputWorkspace";
import { HelpWorkspacePanel } from "./ux/HelpWorkspacePanel";
import { ProductIntakeWorkspace } from "../product-intake/ProductIntakeWorkspace";
import { ImageOrganizationWorkspace } from "../image-organization/ImageOrganizationWorkspace";
import { ProductInformationWorkspace } from "../product-profile/ProductInformationWorkspace";
import { ProductValidationWorkspace } from "../product-validation/ProductValidationWorkspace";
import { VisualAnalysisWorkspace } from "../visual-analysis/VisualAnalysisWorkspace";
import { DeepIntelligenceWorkspace } from "../deep-intelligence/DeepIntelligenceWorkspace";
import { MarketResearchWorkspace } from "../market-research/MarketResearchWorkspace";
import { MasterIntelligenceWorkspace } from "../master-intelligence/MasterIntelligenceWorkspace";
import { MarketingStrategyWorkspace } from "../marketing-strategy/MarketingStrategyWorkspace";
import { CreativePlannerWorkspace } from "../creative-planner/CreativePlannerWorkspace";
import { VideoProductionWorkspace } from "../video-production/VideoProductionWorkspace";
import { ProductionPlanWorkspace } from "../production-plan/ProductionPlanWorkspace";
import { ProductionQueueWorkspace } from "../production-queue/ProductionQueueWorkspace";
import { ProductionPipelineWorkspace } from "../production-pipeline/ProductionPipelineWorkspace";
import { ProductionCommandCenterWorkspace } from "../production-command-center/ProductionCommandCenterWorkspace";
import { ProductionFinalWorkspace } from "../production-final/ProductionFinalWorkspace";
import { ProductionHistoryWorkspace } from "../production-final/ProductionHistoryWorkspace";
import { CreativeReviewWorkspace } from "../creative-review/CreativeReviewWorkspace";
import { CreativeAssistantWorkspace } from "../creative-assistant/CreativeAssistantWorkspace";
import { PersistentMemoryWorkspace } from "../persistent-memory/PersistentMemoryWorkspace";
import { SystemHealthWorkspace } from "../system-health/SystemHealthWorkspace";
import { loadStep2AssistantHandoff } from "../creative-review/review-engine";
import { loadFinalCompleteHandoff } from "../production-final/final-engine";
import type { CoreStatus, WorkspaceId } from "./types";
import { mapLegacyWorkspace } from "./workspace-registry";
import { PlaceholderWorkspace } from "./ProductionWorkspace";

function shouldUseCreativeAssistant(): boolean {
  try {
    return Boolean(loadStep2AssistantHandoff()?.productionId || loadFinalCompleteHandoff()?.package?.productionId);
  } catch {
    return false;
  }
}

interface WorkspaceRouterProps {
  workspace: WorkspaceId;
  core: CoreStatus | null;
  onNavigate: (workspace: WorkspaceId) => void;
}

export function WorkspaceRouter({ workspace, core, onNavigate }: WorkspaceRouterProps): ReactNode {
  switch (workspace) {
    case "home":
      return <ProfessionalDashboard workspaceLabel="Home" onNavigate={(id) => onNavigate(mapLegacyWorkspace(id))} />;
    case "open-project":
    case "recent-projects":
      return <ProjectWorkspace />;
    case "asset-library":
      return <ProjectWorkspace mediaOnly />;
    case "image-organization":
      return <ImageOrganizationWorkspace />;
    case "product-information":
      return <ProductInformationWorkspace />;
    case "product-validation":
      return <ProductValidationWorkspace />;
    case "visual-analysis":
      return <VisualAnalysisWorkspace />;
    case "deep-intelligence":
      return <DeepIntelligenceWorkspace />;
    case "market-research":
      return <MarketResearchWorkspace />;
    case "master-intelligence":
      return <MasterIntelligenceWorkspace />;
    case "marketing-strategy":
      return <MarketingStrategyWorkspace />;
    case "ai-me":
      return shouldUseCreativeAssistant() ? <CreativeAssistantWorkspace /> : <AiStudioWorkspace />;
    case "production":
      return <CreativeEditingWorkspace />;
    case "active-production":
      return <ProductionPipelineWorkspace />;
    case "command-center":
      return <ProductionCommandCenterWorkspace />;
    case "reports":
      return <BusinessIntelligenceWorkspace />;
    case "marketing":
      return <MarketingInputWorkspace />;
    case "new-project":
      return <ProductIntakeWorkspace />;
    case "knowledge-center":
    case "knowledge-search":
      return <PersistentMemoryWorkspace />;
    case "knowledge-packs":
      return placeholder(<Library size={30} />, "Knowledge Packs", "Import and manage local knowledge packs.");
    case "pipeline":
      return <ProductionPlanWorkspace />;
    case "queue":
      return <ProductionQueueWorkspace />;
    case "storyboard":
      return <CreativePlannerWorkspace />;
    case "generated-images":
      return placeholder(<FileImage size={30} />, "Generated Images", "Image generation outputs and gallery.");
    case "generated-videos":
      return <VideoProductionWorkspace />;
    case "generated-audio":
      return placeholder(<FileAudio size={30} />, "Generated Audio", "Audio generation outputs and gallery.");
    case "output":
      return <ProductionFinalWorkspace />;
    case "exports":
      return <ProductionFinalWorkspace />;
    case "creative-review":
      return <CreativeReviewWorkspace />;
    case "history":
      return <ProductionHistoryWorkspace />;
    case "settings":
      return placeholder(<Settings size={30} />, "Settings", "Application settings. Desktop preferences remain available from the sidebar footer.");
    case "system-health":
      return <SystemHealthWorkspace />;
    case "help":
      return <HelpRoute onNavigate={onNavigate} />;
    default:
      return placeholder(<Sparkles size={30} />, "Workspace", core?.aiCore ? "AI online." : "Unknown workspace route.");
  }
}

function HelpRoute({ onNavigate }: { onNavigate: (workspace: WorkspaceId) => void }) {
  return (
    <HelpWorkspacePanel
      onOpenAiMe={() => onNavigate("ai-me")}
      onOpenShortcuts={() => {
        window.dispatchEvent(new CustomEvent("kwizera:open-shortcut-guide"));
      }}
      onStartTour={() => {
        window.dispatchEvent(new CustomEvent("kwizera:start-workspace-tour"));
      }}
    />
  );
}

function placeholder(icon: ReactNode, title: string, description: string) {
  return <PlaceholderWorkspace icon={icon} title={title} description={description} />;
}

export function HomeWelcome({ core }: { core: CoreStatus | null }) {
  return (
    <PlaceholderWorkspace
      icon={<BarChart3 size={30} />}
      title="KWIZERA AI Studio"
      description={core?.aiCore ? "AI engine online. Select a workspace from the navigation." : "Local workspace ready. Select a workspace from the navigation."}
    />
  );
}
