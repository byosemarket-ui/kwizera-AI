import { useCallback, useEffect, useState } from "react";
import { customerServiceRegistry } from "./registry";
import {
  CustomerPage,
  EmptyState,
  LoadingState,
  PrimaryButton,
  ProjectCard,
  QuickAction,
  ResponsiveContainer,
  SectionHeader,
  ServiceCategory,
  ServiceGrid,
} from "./components/ui";
import { resolveCustomerIcon } from "./icons";
import type { CustomerService } from "./types";

export interface CustomerHomeProject {
  id: string;
  name: string;
  modifiedAt?: string;
  productImages?: Array<{ sizeBytes?: number }>;
}

interface WorkspacePayload {
  projects?: CustomerHomeProject[];
}

async function fetchRecentProjects(limit = 6): Promise<CustomerHomeProject[]> {
  try {
    const response = await fetch("/api/workspace");
    if (!response.ok) return [];
    const data = (await response.json()) as WorkspacePayload;
    const projects = Array.isArray(data.projects) ? data.projects : [];
    return [...projects]
      .sort((a, b) => {
        const aTime = a.modifiedAt ? Date.parse(a.modifiedAt) : 0;
        const bTime = b.modifiedAt ? Date.parse(b.modifiedAt) : 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

function projectTypeLabel(project: CustomerHomeProject): string {
  const images = project.productImages?.length ?? 0;
  if (images > 0) return `Photo project · ${images} asset${images === 1 ? "" : "s"}`;
  return "Studio project";
}

function formatUpdated(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function CustomerHome({
  onNavigate,
}: {
  onNavigate: (workspace: string) => void;
}) {
  const primary = customerServiceRegistry.primaryCreationServices();
  const popular = customerServiceRegistry.popularServices();
  const exploreCategories = customerServiceRegistry.exploreCategories();
  const createVideo = customerServiceRegistry.getService("create-video");
  const [projects, setProjects] = useState<CustomerHomeProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    const next = await fetchRecentProjects(6);
    setProjects(next);
    setLoadingProjects(false);
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const onStart = (service: CustomerService) => {
    if (service.status !== "AVAILABLE" || !service.workspace) return;
    onNavigate(service.workspace);
  };

  const startCreating = () => {
    if (createVideo?.status === "AVAILABLE" && createVideo.workspace) {
      onNavigate(createVideo.workspace);
      return;
    }
    onNavigate("new-project");
  };

  const quickActions = customerServiceRegistry.quickActionsForHome();
  const FolderIcon = resolveCustomerIcon("folder");
  const UploadIcon = resolveCustomerIcon("image");
  const PlusIcon = resolveCustomerIcon("sparkles");

  return (
    <section className="cp-home" data-customer-home="true" data-customer-catalog="true" aria-label="Customer home">
      <CustomerPage>
        <ResponsiveContainer>
          <header className="cp-hero" data-customer-hero="true">
            <p className="cp-label">KWIZERA AI STUDIO</p>
            <h1 className="cp-page-title">Create something amazing today.</h1>
            <p className="cp-body cp-hero-copy">
              Create videos, edit photos, design graphics and more with KWIZERA AI STUDIO.
            </p>
            <div className="cp-hero-actions">
              <PrimaryButton onClick={startCreating}>
                {createVideo?.status === "AVAILABLE" ? "Create Video" : "Start Creating"}
              </PrimaryButton>
              <button type="button" className="cp-button-secondary" onClick={() => onNavigate("open-project")}>
                My Projects
              </button>
            </div>
          </header>

          <section className="cp-primary-create" aria-labelledby="cp-primary-heading">
            <SectionHeader
              title="What do you want to create?"
              description="Start with a primary service. Coming soon items stay visible but do not open unfinished workflows."
            />
            <h2 id="cp-primary-heading" className="cp-sr-only">Primary creation actions</h2>
            <ServiceGrid services={primary} onStart={onStart} emptyTitle="No primary services configured" />
          </section>

          <section className="cp-quick-actions-section" aria-label="Quick actions">
            <SectionHeader title="Quick actions" description="Common next steps with working destinations." />
            <div className="cp-actions">
              <QuickAction
                label="New Project"
                icon={<PlusIcon size={16} />}
                onClick={() => onNavigate("new-project")}
              />
              <QuickAction
                label="Upload Photos"
                icon={<UploadIcon size={16} />}
                onClick={() => onNavigate("image-organization")}
              />
              {quickActions.map((service) => {
                const Icon = resolveCustomerIcon(service.icon);
                return (
                  <QuickAction
                    key={service.key}
                    label={service.title}
                    icon={<Icon size={16} />}
                    onClick={() => onStart(service)}
                  />
                );
              })}
              <QuickAction
                label="My Projects"
                icon={<FolderIcon size={16} />}
                onClick={() => onNavigate("open-project")}
              />
            </div>
          </section>

          <section className="cp-popular-section" aria-labelledby="cp-popular-heading">
            <SectionHeader title="Popular services" description="Featured customer services from the shared registry." />
            <h2 id="cp-popular-heading" className="cp-sr-only">Popular services</h2>
            <ServiceGrid services={popular} onStart={onStart} />
          </section>

          <section className="cp-explore-section" aria-label="Explore services">
            <SectionHeader title="Explore services" description="Browse by category. Only available services open a real workspace." />
            {exploreCategories.map(({ category, services }) => (
              <ServiceCategory key={category.key} category={category}>
                <ServiceGrid services={services} onStart={onStart} />
              </ServiceCategory>
            ))}
          </section>

          <section className="cp-recent-projects" aria-labelledby="cp-recent-heading">
            <SectionHeader
              title="Recent projects"
              description="Your latest studio work."
              actions={
                <button type="button" className="cp-button-secondary" onClick={() => onNavigate("open-project")}>
                  View all
                </button>
              }
            />
            <h2 id="cp-recent-heading" className="cp-sr-only">Recent projects</h2>
            {loadingProjects ? (
              <LoadingState label="Loading projects…" />
            ) : projects.length === 0 ? (
              <EmptyState
                title="No projects yet."
                detail="Create your first project to see it here."
                action={<PrimaryButton onClick={startCreating}>Start Creating</PrimaryButton>}
              />
            ) : (
              <div className="cp-project-grid" role="list">
                {projects.map((project) => (
                  <div key={project.id} role="listitem">
                    <ProjectCard
                      title={project.name}
                      detail={projectTypeLabel(project)}
                      updatedAt={formatUpdated(project.modifiedAt)}
                      status="Ready"
                      onOpen={() => onNavigate("open-project")}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="cp-my-work" aria-label="My work">
            <SectionHeader title="My work" description="Jump back into projects and assets." />
            <div className="cp-actions">
              <QuickAction label="Projects" icon={<FolderIcon size={16} />} onClick={() => onNavigate("open-project")} />
              <QuickAction label="Assets" icon={<UploadIcon size={16} />} onClick={() => onNavigate("asset-library")} />
            </div>
          </section>
        </ResponsiveContainer>
      </CustomerPage>
    </section>
  );
}
