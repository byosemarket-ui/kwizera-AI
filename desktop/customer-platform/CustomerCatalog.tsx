import { customerServiceRegistry } from "./registry";
import { CustomerHome } from "./CustomerHome";
import { ServiceCategory, ServiceGrid } from "./components/ui";
import type { CustomerService } from "./types";

/**
 * Service catalog surface — used by Customer Home and any dedicated catalog route.
 * Backed entirely by the shared service registry (no duplicate definitions).
 */
export function CustomerCatalog({
  onNavigate,
  mode = "full",
}: {
  onNavigate: (workspace: string) => void;
  projects?: Array<{ id: string; name: string }>;
  mode?: "full" | "home";
}) {
  if (mode === "home") {
    return <CustomerHome onNavigate={onNavigate} />;
  }

  const explore = customerServiceRegistry.exploreCategories();

  const onStart = (service: CustomerService) => {
    if (service.status !== "AVAILABLE" || !service.workspace) return;
    onNavigate(service.workspace);
  };

  return (
    <section className="cp-catalog" data-customer-catalog="true" aria-label="Customer service catalog">
      {explore.map(({ category, services }) => (
        <ServiceCategory key={category.key} category={category}>
          <ServiceGrid services={services} onStart={onStart} />
        </ServiceCategory>
      ))}
    </section>
  );
}
