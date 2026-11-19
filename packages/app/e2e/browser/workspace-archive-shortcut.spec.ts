import { existsSync } from "node:fs";
import { expect, test, type Page } from "../support/fixtures";
import { gotoAppShell } from "../support/helpers/app";
import { seedWorkspace, type SeededWorkspace } from "../support/helpers/seed-client";
import { getServerId } from "../support/helpers/server-id";
import {
  expectWorkspaceAbsentFromSidebar,
  selectSidebarStatusGrouping,
  selectWorkspaceInSidebar,
} from "../support/helpers/sidebar";
import { waitForSidebarHydration } from "../support/helpers/workspace-ui";

const ARCHIVE_SHORTCUT = "ControlOrMeta+Shift+Backspace";

function workspaceRow(page: Page, workspaceId: string) {
  return page.getByTestId(`sidebar-workspace-row-${getServerId()}:${workspaceId}`);
}

async function collapseProjectSection(page: Page, workspace: SeededWorkspace): Promise<void> {
  const header = page
    .locator('[data-testid^="sidebar-project-row-"]')
    .filter({ hasText: workspace.projectDisplayName });
  await expect(header).toHaveCount(1, { timeout: 30_000 });
  await header.click();
  await expect(workspaceRow(page, workspace.workspaceId)).toHaveCount(0, { timeout: 10_000 });
}

async function collapseStatusGroupContaining(page: Page, workspaceId: string): Promise<void> {
  const rows = page
    .locator('[data-testid^="sidebar-status-group-rows-"]')
    .filter({ has: workspaceRow(page, workspaceId) });
  await expect(rows).toHaveCount(1, { timeout: 30_000 });
  const bucket = (await rows.getAttribute("data-testid"))?.replace(
    "sidebar-status-group-rows-",
    "",
  );
  expect(bucket).toBeTruthy();
  await page.getByTestId(`sidebar-status-group-${bucket}`).click();
  await expect(workspaceRow(page, workspaceId)).toHaveCount(0, { timeout: 10_000 });
}

async function expectArchivedOnHost(workspace: SeededWorkspace): Promise<void> {
  await expect
    .poll(
      async () => {
        const { entries } = await workspace.client.fetchWorkspaces();
        return entries.some((entry) => entry.id === workspace.workspaceId);
      },
      { timeout: 30_000 },
    )
    .toBe(false);
}

test.describe("Workspace archive shortcut", () => {
  test("archives the selected workspace without removing its local checkout", async ({ page }) => {
    const workspace = await seedWorkspace({ repoPrefix: "archive-shortcut-" });

    try {
      await gotoAppShell(page);
      await waitForSidebarHydration(page);
      await selectWorkspaceInSidebar(page, workspace.workspaceId);

      await page.keyboard.press(ARCHIVE_SHORTCUT);

      await expectWorkspaceAbsentFromSidebar(page, workspace.workspaceId);
      expect(existsSync(workspace.repoPath)).toBe(true);
    } finally {
      await workspace.cleanup();
    }
  });

  test("archives the active workspace while its project section is collapsed", async ({ page }) => {
    const workspace = await seedWorkspace({ repoPrefix: "archive-shortcut-collapsed-" });

    try {
      await gotoAppShell(page);
      await waitForSidebarHydration(page);
      await selectWorkspaceInSidebar(page, workspace.workspaceId);
      await collapseProjectSection(page, workspace);

      await page.keyboard.press(ARCHIVE_SHORTCUT);

      await expectArchivedOnHost(workspace);
    } finally {
      await workspace.cleanup();
    }
  });

  test("archives the active workspace while its status group is collapsed", async ({ page }) => {
    const workspace = await seedWorkspace({ repoPrefix: "archive-shortcut-status-" });

    try {
      await gotoAppShell(page);
      await waitForSidebarHydration(page);
      await selectWorkspaceInSidebar(page, workspace.workspaceId);
      await selectSidebarStatusGrouping(page);
      await collapseStatusGroupContaining(page, workspace.workspaceId);

      await page.keyboard.press(ARCHIVE_SHORTCUT);

      await expectArchivedOnHost(workspace);
    } finally {
      await workspace.cleanup();
    }
  });
});
