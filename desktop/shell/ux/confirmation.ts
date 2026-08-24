import type { ConfirmKind, ConfirmRequest, ConfirmResult } from "./types";

type Resolver = (result: ConfirmResult) => void;

export class ConfirmationService {
  private pending: ConfirmRequest | null = null;
  private resolver: Resolver | null = null;
  private listeners = new Set<(req: ConfirmRequest | null) => void>();

  subscribe(listener: (req: ConfirmRequest | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.pending);
    return () => this.listeners.delete(listener);
  }

  getPending(): ConfirmRequest | null {
    return this.pending;
  }

  ask(partial: Omit<ConfirmRequest, "id"> & { id?: string }): Promise<ConfirmResult> {
    const request: ConfirmRequest = {
      id: partial.id ?? `confirm-${Date.now().toString(36)}`,
      kind: partial.kind,
      title: partial.title,
      detail: partial.detail,
      confirmLabel: partial.confirmLabel ?? defaultConfirmLabel(partial.kind),
      cancelLabel: partial.cancelLabel ?? "Cancel",
      destructive: partial.destructive ?? isDestructive(partial.kind),
    };
    // Replace any prior pending with cancel
    if (this.resolver && this.pending) {
      this.resolver({ confirmed: false, id: this.pending.id });
    }
    this.pending = request;
    this.listeners.forEach((l) => l(request));
    return new Promise<ConfirmResult>((resolve) => {
      this.resolver = resolve;
    });
  }

  resolve(confirmed: boolean): void {
    if (!this.pending || !this.resolver) return;
    const id = this.pending.id;
    const resolver = this.resolver;
    this.pending = null;
    this.resolver = null;
    this.listeners.forEach((l) => l(null));
    resolver({ confirmed, id });
  }

  cancel(): void {
    this.resolve(false);
  }
}

function isDestructive(kind: ConfirmKind): boolean {
  return kind === "delete" || kind === "reset" || kind === "cancel-production" || kind === "replace-output";
}

function defaultConfirmLabel(kind: ConfirmKind): string {
  switch (kind) {
    case "delete": return "Delete";
    case "reset": return "Reset";
    case "cancel-production": return "Cancel production";
    case "close-project": return "Close project";
    case "replace-output": return "Replace";
    case "restore-workspace": return "Restore";
    default: return "Confirm";
  }
}

export const confirmationService = new ConfirmationService();
