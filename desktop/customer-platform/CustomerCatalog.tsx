import { customerServiceRegistry } from "./registry";
import { CustomerPage, QuickAction, ResponsiveContainer, SectionHeader, ServiceCategory, ServiceGrid } from "./components/ui";
import { resolveCustomerIcon } from "./icons";
import type { CustomerService } from "./types";

export function CustomerCatalog({
  onNavigate,
  projects = [],
}: {
  onNavigate: (workspace: string) => void;
  projects?: Array<{ id: string; name: string }>;
}) {
  const featured = customerServiceRegistry.featuredForHome();
  const categories = customerServiceRegistry.categories.filter((category) =>
    featured.some((service) => service.category === category.key),
  );
  const VideoIcon = resolveCustomerIcon("clapperboard");
  const ImageIcon = resolveCustomerIcon("image");
  const FolderIcon = resolveCustomerIcon("folder");

  const onStart = (service: CustomerService) => {
    if (service.status !== "AVAILABLE" || !service.workspace) return;
    onNavigate(service.workspace);
  };

  return (
    <section className="cp-catalog" data-customer-catalog="true" aria-label="Customer services">
      <CustomerPage>
        <ResponsiveContainer>
          <header>
            <p className="cp-label">Create</p>
            <h1 className="cp-page-title">What do you want to create?</h1>
            <p className="cp-body">Choose a service. Coming soon items are listed honestly and cannot be started yet.</p>
          </header>
          <div className="cp-actions" aria-label="Quick actions">
            <QuickAction label="Create video" icon={<VideoIcon size={16} />} onClick={() => onNavigate("generated-videos")} />
            <QuickAction label="Edit photo" icon={<ImageIcon size={16} />} onClick={() => onNavigate("visual-analysis")} />
            <QuickAction label="My projects" icon={<FolderIcon size={16} />} onClick={() => onNavigate("open-project")} />
          </div>
          <SectionHeader
            title="Services"
            description="Customer catalog from the shared service registry. Internal production tools remain available below."
          />
          {categories.map((category) => (
            <ServiceCategory key={category.key} category={category}>
              <ServiceGrid
                services={featured.filter((service) => service.category === category.key)}
                onStart={onStart}
              />
            </ServiceCategory>
          ))}
          {projects.length > 0 ? (
            <p className="cp-caption">{projects.length} project{projects.length === 1 ? "" : "s"} in this studio.</p>
          ) : (
            <p className="cp-caption">No projects yet — start with Create video or a new product video.</p>
          )}
        </ResponsiveContainer>
      </CustomerPage>
    </section>
  );
}
