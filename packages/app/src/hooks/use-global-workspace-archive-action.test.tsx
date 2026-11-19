/** @vitest-environment jsdom */
import React, { type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  KeyboardActionDispatcherProvider,
  useKeyboardActionDispatcher,
} from "@/keyboard/keyboard-action-dispatcher-context";
import { useGlobalWorkspaceArchiveAction } from "./use-global-workspace-archive-action";

const state = vi.hoisted(() => ({
  selection: null as { serverId: string; workspaceId: string } | null,
  workspace: null as Record<string, unknown> | null,
  archive: vi.fn(),
  archiveInput: null as Record<string, unknown> | null,
}));

vi.mock("@/stores/navigation-active-workspace-store", () => ({
  useActiveWorkspaceSelection: () => state.selection,
}));
vi.mock("@/stores/session-store-hooks", () => ({
  useWorkspaceFields: (
    _serverId: string | null,
    _workspaceId: string | null,
    project: (workspace: Record<string, unknown>) => unknown,
  ) => (state.workspace ? project(state.workspace) : null),
}));
vi.mock("@/workspace/use-workspace-archive", () => ({
  useWorkspaceArchive: (input: Record<string, unknown>) => {
    state.archiveInput = input;
    return { archive: state.archive };
  },
}));
vi.mock("@/utils/sidebar-workspace-archive-redirect", () => ({
  redirectIfArchivingActiveWorkspace: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <KeyboardActionDispatcherProvider>{children}</KeyboardActionDispatcherProvider>;
}

function renderArchiveAction() {
  const { result } = renderHook(
    () => {
      useGlobalWorkspaceArchiveAction();
      return useKeyboardActionDispatcher();
    },
    { wrapper },
  );
  return () => result.current.dispatch({ id: "workspace.archive", scope: "sidebar" });
}

describe("global workspace archive shortcut", () => {
  beforeEach(() => {
    state.selection = { serverId: "local", workspaceId: "route-id" };
    state.workspace = {
      id: "descriptor-id",
      workspaceKind: "worktree",
      name: "feature",
      workspaceDirectory: "/repo/feature",
      archivingAt: null,
      diffStat: null,
    };
    state.archive.mockClear();
    state.archiveInput = null;
  });

  it("archives the active workspace without a sidebar row mounted", () => {
    const dispatch = renderArchiveAction();

    expect(dispatch()).toBe(true);
    expect(state.archive).toHaveBeenCalledOnce();
    expect(state.archiveInput).toMatchObject({
      serverId: "local",
      workspaceId: "descriptor-id",
      workspaceKind: "worktree",
      workspaceDirectory: "/repo/feature",
    });
  });

  it("leaves the shortcut unhandled without an active workspace", () => {
    state.selection = null;
    state.workspace = null;
    const dispatch = renderArchiveAction();

    expect(dispatch()).toBe(false);
    expect(state.archive).not.toHaveBeenCalled();
  });

  it("leaves the shortcut unhandled while the workspace is already archiving", () => {
    state.workspace = { ...state.workspace, archivingAt: "2026-11-19T00:00:00.000Z" };
    const dispatch = renderArchiveAction();

    expect(dispatch()).toBe(false);
    expect(state.archive).not.toHaveBeenCalled();
  });
});
