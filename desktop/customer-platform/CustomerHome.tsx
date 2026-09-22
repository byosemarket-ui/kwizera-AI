import { useCallback, useEffect, useState } from "react";
import { customerServiceRegistry } from "./registry";
import {
  CategoryCard,
  CustomerPage,
  EmptyState,
  LoadingState,
  PrimaryButton,
  ProjectCard,
  ResponsiveContainer,
  SectionHeader,
  ServiceGrid,
} from "./components/ui";
import type { CustomerCategory, CustomerService } from "./types";
import { isCustomerVisibleProjectName } from "./project-visibility";

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
      .filter((project) => isCustomerVisibleProjectName(project.name))
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
  return "Project";
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

  const openCategory = (category: CustomerCategory) => {
    const firstAvailable = customerServiceRegistry
      .listByCategory(category.key)
      .find((item) => item.status === "AVAILABLE" && item.workspace);
    if (firstAvailable?.workspace) {
      onNavigate(firstAvailable.workspace);
    }
  };

  const categoryStatus = (categoryKey: string) => {
    const services = customerServiceRegistry.listByCategory(categoryKey as CustomerCategory["key"]);
    if (services.some((item) => item.status === "AVAILABLE" && item.workspace)) return "AVAILABLE" as const;
    if (services.every((item) => item.status === "DISABLED")) return "DISABLED" as const;
    return "COMING_SOON" as const;
  };

  return (
    <section className="cp-home" data-customer-home="true" data-customer-catalog="true" aria-label="Customer home">
      <CustomerPage>
        <ResponsiveContainer>
          <header className="cp-hero" data-customer-hero="true">
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
            <SectionHeader title="What do you want to create?" />
            <h2 id="cp-primary-heading" className="cp-sr-only">Primary creation actions</h2>
            <ServiceGrid services={primary} onStart={onStart} emptyTitle="No primary services configured" />
          </section>

          <section className="cp-recent-projects" aria-labelledby="cp-recent-heading">
            <SectionHeader
              title="Recent projects"
              actions={
                projects.length > 0 ? (
                  <button type="button" className="cp-button-secondary" onClick={() => onNavigate("open-project")}>
                    View all
                  </button>
                ) : undefined
              }
            />
            <h2 id="cp-recent-heading" className="cp-sr-only">Recent projects</h2>
            {loadingProjects ? (
              <LoadingState label="Loading projects…" />
            ) : projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                detail="Start creating something and your work will appear here."
                action={<PrimaryButton onClick={startCreating}>Create Video</PrimaryButton>}
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

          <section className="cp-explore-section" aria-label="Explore services">
            <SectionHeader title="Explore services" />
            <div className="cp-category-grid" role="list">
              {exploreCategories.map(({ category }) => (
                <div key={category.key} role="listitem">
                  <CategoryCard
                    category={category}
                    status={categoryStatus(category.key)}
                    onOpen={openCategory}
                  />
                </div>
              ))}
            </div>
          </section>
        </ResponsiveContainer>
      </CustomerPage>
    </section>
  );
}
