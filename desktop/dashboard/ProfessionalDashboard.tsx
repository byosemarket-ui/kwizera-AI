/**
 * Customer Home workspace entry.
 * Renders the commercial Customer Home — not the internal production dashboard.
 * Technical dashboard engines (live-engine, widget-store, cards) remain in this package
 * for advanced / future surfaces; they must not dominate the customer Home experience.
 */
import { CustomerHome } from "../customer-platform/CustomerHome";

interface ProfessionalDashboardProps {
  onNavigate: (workspace: string) => void;
  workspaceLabel?: string;
}

export function ProfessionalDashboard({ onNavigate }: ProfessionalDashboardProps) {
  return (
    <div className="professional-dashboard customer-home-shell" data-customer-surface="home">
      <CustomerHome onNavigate={onNavigate} />
    </div>
  );
}
