import { useEffect } from "react";
import { CustomerNavSection } from "./CustomerNavSection";

export function CustomerMobileNavDrawer({
  open,
  onClose,
  onNavigate,
  currentWorkspace,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (workspace: string) => void;
  currentWorkspace?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        className={`cp-mobile-nav-scrim ${open ? "is-open" : ""}`}
        aria-label="Close navigation"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        id="customer-mobile-nav"
        className={`cp-mobile-nav-drawer ${open ? "is-open" : ""}`}
        data-customer-mobile-nav="true"
        aria-label="Customer navigation drawer"
        aria-hidden={!open}
        aria-modal={open}
        role="dialog"
      >
        <CustomerNavSection
          onNavigate={(workspace) => {
            onNavigate(workspace);
            onClose();
          }}
          currentWorkspace={currentWorkspace}
        />
      </aside>
    </>
  );
}
