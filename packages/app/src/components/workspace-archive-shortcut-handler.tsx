import { useGlobalWorkspaceArchiveAction } from "@/hooks/use-global-workspace-archive-action";

// Headless so the active workspace's git and diff updates re-render only this component.
export function WorkspaceArchiveShortcutHandler() {
  useGlobalWorkspaceArchiveAction();
  return null;
}
