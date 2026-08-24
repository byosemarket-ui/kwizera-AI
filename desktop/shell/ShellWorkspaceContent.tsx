import { useShell } from "./ShellContext";
import type { CoreStatus } from "./types";
import { WorkspaceRouter } from "./WorkspaceRouter";

/** Renders active workspace content using shell context layout state */
export function ShellWorkspaceContent({ core }: { core: CoreStatus | null }) {
  const { layout, switchWorkspace } = useShell();
  return (
    <WorkspaceRouter
      workspace={layout.workspace}
      core={core}
      onNavigate={switchWorkspace}
    />
  );
}
