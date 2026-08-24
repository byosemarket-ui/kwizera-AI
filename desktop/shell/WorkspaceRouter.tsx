import type { ReactNode } from "react";
import {
  Activity, BarChart3, BookOpen, Clapperboard, Download, FileAudio, FileImage, FileVideo,
  History, Library, ListOrdered, Package, Search, Settings, Sparkles, Workflow,
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
import type { CoreStatus, WorkspaceId } from "./types";
import { mapLegacyWorkspace } from "./workspace-registry";
import { PlaceholderWorkspace } from "./ProductionWorkspace";

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
    case "ai-me":
      return <AiStudioWorkspace />;
    case "production":
    case "active-production":
      return <CreativeEditingWorkspace />;
    case "reports":
      return <BusinessIntelligenceWorkspace />;
    case "marketing":
      return <MarketingInputWorkspace />;
    case "new-project":
      return <ProductIntakeWorkspace />;
    case "knowledge-center":
      return placeholder(<BookOpen size={30} />, "Knowledge Center", "Knowledge retrieval and context modules will mount here.");
    case "knowledge-packs":
      return placeholder(<Library size={30} />, "Knowledge Packs", "Import and manage local knowledge packs.");
    case "knowledge-search":
      return placeholder(<Search size={30} />, "Knowledge Search", "Search across seeded knowledge domains.");
    case "pipeline":
      return placeholder(<Workflow size={30} />, "Pipeline", "Production pipeline stages will appear here.");
    case "queue":
      return placeholder(<ListOrdered size={30} />, "Queue", "Local production queue and job list.");
    case "storyboard":
      return placeholder(<Clapperboard size={30} />, "Storyboard", "Storyboard and scene planning workspace.");
    case "generated-images":
      return placeholder(<FileImage size={30} />, "Generated Images", "Image generation outputs and gallery.");
    case "generated-videos":
      return placeholder(<FileVideo size={30} />, "Generated Videos", "Video generation outputs and gallery.");
    case "generated-audio":
      return placeholder(<FileAudio size={30} />, "Generated Audio", "Audio generation outputs and gallery.");
    case "output":
      return placeholder(<Package size={30} />, "Outputs", "Final renders and delivery previews.");
    case "exports":
      return placeholder(<Download size={30} />, "Exports", "Export packages and delivery formats.");
    case "history":
      return placeholder(<History size={30} />, "History", "Production and navigation history.");
    case "settings":
      return placeholder(<Settings size={30} />, "Settings", "Application settings. Desktop preferences remain available from the sidebar footer.");
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
