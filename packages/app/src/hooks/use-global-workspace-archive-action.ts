import { useCallback, useState } from "react";
import { useKeyboardActionHandler } from "@/hooks/use-keyboard-action-handler";
import type { KeyboardActionId } from "@/keyboard/keyboard-action-dispatcher";
import { useActiveWorkspaceSelection } from "@/stores/navigation-active-workspace-store";
import { useWorkspaceFields } from "@/stores/session-store-hooks";
import { redirectIfArchivingActiveWorkspace } from "@/utils/sidebar-workspace-archive-redirect";
import { useWorkspaceArchive } from "@/workspace/use-workspace-archive";

const WORKSPACE_ARCHIVE_ACTIONS: readonly KeyboardActionId[] = ["workspace.archive"];

// Registered once for the active route selection rather than by the sidebar row, because the row
// is not rendered while its project, status group or Pinned section is collapsed.
export function useGlobalWorkspaceArchiveAction() {
  const selection = useActiveWorkspaceSelection();
  const serverId = selection?.serverId ?? null;
  // The route id is opaque; the archive RPC needs the descriptor id.
  const fields = useWorkspaceFields(serverId, selection?.workspaceId ?? null, (workspace) => ({
    id: workspace.id,
    workspaceKind: workspace.workspaceKind,
    name: workspace.name,
    workspaceDirectory: workspace.workspaceDirectory,
    archivingAt: workspace.archivingAt,
    diffStat: workspace.diffStat,
  }));
  const [isHiding, setIsHiding] = useState(false);

  const archiveController = useWorkspaceArchive({
    serverId: serverId ?? "",
    workspaceId: fields?.id ?? "",
    workspaceKind: fields?.workspaceKind ?? "directory",
    workspaceDirectory: fields?.workspaceDirectory ?? "",
    name: fields?.name ?? "",
    diffStat: fields?.diffStat ?? null,
    onArchiveStarted: (archived) => {
      redirectIfArchivingActiveWorkspace({ ...archived, activeWorkspaceSelection: selection });
    },
    onSetHiding: setIsHiding,
  });

  const handle = useCallback(() => {
    archiveController.archive();
    return true;
  }, [archiveController]);

  useKeyboardActionHandler({
    handlerId: "workspace-archive-global",
    actions: WORKSPACE_ARCHIVE_ACTIONS,
    enabled: serverId !== null && fields !== null && fields.archivingAt === null && !isHiding,
    priority: 0,
    handle,
  });
}
