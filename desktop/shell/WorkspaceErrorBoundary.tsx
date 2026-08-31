import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { WorkspaceId } from "./types";

interface Props {
  workspace: WorkspaceId;
  onRecover: (workspace: WorkspaceId) => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
  workspaceAtError: WorkspaceId | null;
}

/** Prevents a single workspace render failure from leaving a permanent blank main panel. */
export class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null, workspaceAtError: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[KWIZERA] Workspace render failed:", {
      workspace: this.props.workspace,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    this.setState({ workspaceAtError: this.props.workspace });
    if (this.props.workspace !== "home") {
      this.props.onRecover("home");
    }
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.workspace !== this.props.workspace && this.state.error) {
      this.setState({ error: null, workspaceAtError: null });
    }
  }

  render(): ReactNode {
    if (this.state.error && this.props.workspace === "home") {
      return (
        <section className="startup-recovery-panel" role="alert">
          <AlertTriangle size={28} />
          <h2>Workspace recovery</h2>
          <p>
            Home could not render completely ({this.state.error.message}).
            Your projects and saved data are still on this device.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null, workspaceAtError: null });
              window.location.reload();
            }}
          >
            Reload application
          </button>
        </section>
      );
    }
    if (this.state.error) {
      return (
        <section className="startup-recovery-panel" role="status">
          <p>Returning to Home…</p>
        </section>
      );
    }
    return this.props.children;
  }
}
