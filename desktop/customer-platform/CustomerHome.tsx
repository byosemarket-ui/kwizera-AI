import { customerServiceRegistry } from "./registry";
import {
  CustomerPage,
  PrimaryButton,
  ResponsiveContainer,
  SectionHeader,
  ServiceCategory,
  ServiceGrid,
} from "./components/ui";
import { resolveCustomerIcon } from "./icons";
import type { CustomerService } from "./types";

const HOME_CATEGORY_ORDER = [
  "VIDEO",
  "IMAGE",
  "PHOTO_STUDIO",
  "DESIGN",
  "AUDIO",
  "VOICE",
] as const;

function categoryNavLabel(key: string, title: string): string {
  if (key === "PHOTO_STUDIO") return "Photo Studio";
  if (key === "DESIGN") return "Design";
  return title;
}

function scrollToCategory(key: string) {
  const el = document.getElementById(`cp-home-cat-${key}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function CustomerHome({
  onNavigate,
}: {
  onNavigate: (workspace: string) => void;
}) {
  const catalog = customerServiceRegistry.homeServiceCatalog();
  const FolderIcon = resolveCustomerIcon("folder");

  const onStart = (service: CustomerService) => {
    if (service.status !== "AVAILABLE" || !service.workspace) return;
    onNavigate(service.workspace);
  };

  return (
    <section className="cp-home" data-customer-home="true" data-customer-catalog="true" aria-label="Customer home">
      <CustomerPage>
        <ResponsiveContainer>
          <header className="cp-welcome" data-customer-hero="true">
            <p className="cp-welcome-line">
              Welcome to <span>KWIZERA AI STUDIO</span>
            </p>
          </header>

          <section className="cp-service-catalog" aria-labelledby="cp-catalog-heading">
            <SectionHeader
              title="What do you want to create?"
              description="Browse creative services by category."
            />
            <h2 id="cp-catalog-heading" className="cp-sr-only">Service catalog</h2>

            <nav className="cp-category-jump" aria-label="Service categories">
              <div className="cp-catalog-grid cp-category-jump-grid" role="list">
                {HOME_CATEGORY_ORDER.map((key) => {
                  const entry = catalog.find((item) => item.category.key === key);
                  if (!entry) return null;
                  const label = categoryNavLabel(entry.category.key, entry.category.title);
                  return (
                    <div key={key} role="listitem">
                      <button
                        type="button"
                        className="cp-category-jump-btn"
                        data-category-key={key}
                        onClick={() => scrollToCategory(key)}
                      >
                        {label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </nav>

            <div className="cp-home-categories" data-customer-service-grid="true">
              {catalog.map(({ category, services }) => (
                <ServiceCategory
                  key={category.key}
                  category={category}
                  id={`cp-home-cat-${category.key}`}
                  compact
                >
                  <ServiceGrid services={services} onStart={onStart} />
                </ServiceCategory>
              ))}
            </div>
          </section>

          <section className="cp-my-projects-entry" aria-label="My projects" data-home-footer="true">
            <div className="cp-my-projects-card">
              <div className="cp-my-projects-copy">
                <span className="cp-service-icon" aria-hidden="true"><FolderIcon size={18} /></span>
                <div>
                  <h2 className="cp-section-title">My Projects</h2>
                  <p className="cp-body">Open, continue, and manage your creative work.</p>
                </div>
              </div>
              <PrimaryButton onClick={() => onNavigate("open-project")}>
                My Projects
              </PrimaryButton>
            </div>
          </section>
        </ResponsiveContainer>
      </CustomerPage>
    </section>
  );
}
