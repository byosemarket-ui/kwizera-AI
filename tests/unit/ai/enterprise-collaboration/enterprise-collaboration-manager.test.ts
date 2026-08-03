import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EnterpriseCollaborationManager } from "../../../../ai/enterprise-collaboration/enterprise-collaboration-manager.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("EnterpriseCollaborationManager", () => {
  it("keeps a local owner usable while persisting teams, permissions, shares, locks, audit events, and notifications", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-enterprise-")); roots.push(root);
    const manager = new EnterpriseCollaborationManager(); await manager.initialize(root);
    const organization = manager.listOrganizations()[0];
    await manager.addDepartment("local-owner", organization.id, "Marketing");
    await manager.updateOrganization("local-owner", organization.id, { branding: { accentColor: "#245d4b" }, settings: { approvalRequired: true } });
    await manager.createCustomRole("local-owner", organization.id, { id: "campaign-reviewer", name: "Campaign Reviewer", permissions: ["project.view", "project.edit", "collaboration.lock"] });
    const otherOrganization = await manager.createOrganization("local-owner", { name: "Separate workspace" });
    await expect(manager.inviteMember("local-owner", otherOrganization.id, { displayName: "Cross tenant", roleId: "campaign-reviewer" })).rejects.toThrow("Role not found for this organization");
    const team = await manager.createTeam("local-owner", organization.id, "Creative team");
    const invited = await manager.inviteMember("local-owner", organization.id, { displayName: "Designer", email: "designer@example.com", roleId: "campaign-reviewer" });
    await manager.acceptInvitation(invited.id, organization.id);
    await manager.addMemberToTeam("local-owner", organization.id, team.id, invited.id);
    const shared = await manager.shareResource("local-owner", organization.id, { kind: "project", resourceId: "project-1", teamIds: [team.id] });
    expect(shared.version).toBe(1);
    await expect(manager.acquireProjectLock(invited.id, organization.id, "project-1", 1)).resolves.toMatchObject({ projectId: "project-1", userId: invited.id });
    await expect(manager.acquireProjectLock("local-owner", organization.id, "project-1", 1)).rejects.toThrow("locked");
    await manager.releaseProjectLock(invited.id, organization.id, "project-1", 2);
    const notification = await manager.createNotification("local-owner", organization.id, invited.id, "project-updated", "Project shared", "You can now collaborate on project-1.");
    await manager.markNotificationRead(invited.id, notification.id);
    const restored = new EnterpriseCollaborationManager(); await restored.initialize(root);
    expect(restored.listTeams(organization.id)).toHaveLength(1);
    expect(restored.listActivities(organization.id).some((event) => event.action === "project-unlocked")).toBe(true);
    expect(restored.listNotifications(invited.id)[0]?.readAt).toBeTruthy();
  });
});