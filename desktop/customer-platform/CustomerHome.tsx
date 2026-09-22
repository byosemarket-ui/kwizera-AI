import { customerServiceRegistry } from "./registry";
import {
  CategoryCard,
  CustomerPage,
  PrimaryButton,
  ResponsiveContainer,
  SectionHeader,
} from "./components/ui";
import { resolveCustomerIcon } from "./icons";
import type { CustomerCategory } from "./types";

function homeCategoryTitle(category: CustomerCategory): string {
  if (category.key === "PHOTO_STUDIO") return "Photo";
  if (category.key === "DESIGN" || category.title === "Design Studio") return "Design";
  return category.title;
}

export function CustomerHome({
  onNavigate,
}: {
  onNavigate: (workspace: string) => void;
}) {
  const catalog = customerServiceRegistry.homeCatalogCategories();
  const FolderIcon = resolveCustomerIcon("folder");

  const openCategory = (category: CustomerCategory) => {
    const firstAvailable = customerServiceRegistry
      .listByCategory(category.key)
      .find((item) => item.status === "AVAILABLE" && item.workspace);
    if (firstAvailable?.workspace) {
      onNavigate(firstAvailable.workspace);
    }
  };

  return (
    <section className="cp-home" data-customer-home="true" data-customer-catalog="true" aria-label="Customer home">
      <CustomerPage>
        <ResponsiveContainer>
          <header className="cp-welcome" data-customer-hero="true">
            <p className="cp-welcome-line">
              Welcome to <span>KWIZERA AI STUDIO</span> — let&apos;s create something amazing.
            </p>
          </header>

          <section className="cp-service-catalog" aria-labelledby="cp-catalog-heading">
            <SectionHeader title="What do you want to create?" />
            <h2 id="cp-catalog-heading" className="cp-sr-only">Service catalog</h2>
            <div className="cp-catalog-grid" role="list" data-customer-service-grid="true">
              {catalog.map(({ category, status }) => (
                <div key={category.key} role="listitem">
                  <CategoryCard
                    category={category}
                    status={status}
                    displayTitle={homeCategoryTitle(category)}
                    onOpen={openCategory}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="cp-my-projects-entry" aria-label="My projects">
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
