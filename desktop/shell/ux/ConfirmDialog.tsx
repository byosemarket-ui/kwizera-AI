import { useEffect, useRef } from "react";
import { confirmationService } from "./confirmation";
import { trapFocus } from "./focus";
import type { ConfirmRequest } from "./types";

interface ConfirmDialogProps {
  request: ConfirmRequest | null;
}

export function ConfirmDialog({ request }: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!request || !panelRef.current) return;
    return trapFocus(panelRef.current);
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        confirmationService.cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  if (!request) return null;

  return (
    <div className="ux-confirm-backdrop" role="presentation" onMouseDown={() => confirmationService.cancel()}>
      <div
        ref={panelRef}
        className={`ux-confirm-dialog ${request.destructive ? "destructive" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ux-confirm-title"
        aria-describedby="ux-confirm-detail"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="ux-confirm-title">{request.title}</h2>
        <p id="ux-confirm-detail">{request.detail}</p>
        <div className="ux-confirm-actions">
          <button type="button" className="soft-button" onClick={() => confirmationService.cancel()}>
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            className={`soft-button ${request.destructive ? "ux-confirm-danger" : "ux-confirm-primary"}`}
            autoFocus
            onClick={() => confirmationService.resolve(true)}
          >
            {request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
