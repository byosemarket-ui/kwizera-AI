export type EnterpriseRoleId = "super-administrator" | "organization-administrator" | "project-manager" | "ai-trainer" | "marketing-manager" | "designer" | "video-editor" | "content-creator" | "viewer" | string;
export type EnterprisePermission = "organization.manage" | "team.manage" | "member.manage" | "role.manage" | "project.share" | "project.edit" | "project.view" | "resource.share" | "workflow.run" | "knowledge.share" | "brand.manage" | "audit.read" | "notification.manage" | "collaboration.lock";
export type SharedResourceKind = "project" | "asset" | "template" | "workflow" | "knowledge" | "brand";
export type NotificationKind = "task-assigned" | "project-updated" | "workflow-completed" | "approval-request" | "security-alert" | "collaboration-request";

export interface EnterpriseUser { id: string; displayName: string; email?: string; status: "active" | "invited" | "removed"; createdAt: string; updatedAt: string; }
export interface EnterpriseRole { id: EnterpriseRoleId; name: string; permissions: EnterprisePermission[]; builtIn: boolean; organizationId?: string; }
export interface EnterpriseOrganization { id: string; name: string; ownerId: string; departments: Array<{ id: string; name: string }>; settings: Record<string, boolean | string | number>; branding: { name: string; logoPath?: string; accentColor?: string }; createdAt: string; updatedAt: string; }
export interface EnterpriseTeam { id: string; organizationId: string; name: string; memberIds: string[]; createdAt: string; updatedAt: string; }
export interface EnterpriseMembership { organizationId: string; userId: string; roleId: EnterpriseRoleId; departmentId?: string; joinedAt: string; }
export interface SharedResource { id: string; organizationId: string; kind: SharedResourceKind; resourceId: string; teamIds: string[]; userIds: string[]; version: number; updatedAt: string; }
export interface CollaborationLock { projectId: string; userId: string; version: number; acquiredAt: string; expiresAt: string; }
export interface CollaborationPresence { projectId: string; userId: string; seenAt: string; }
export interface EnterpriseActivity { id: string; at: string; actorId: string; organizationId: string; category: "user" | "team" | "project" | "security" | "workflow" | "publishing" | "administration" | "ai-decision"; action: string; targetId?: string; detail: string; }
export interface EnterpriseNotification { id: string; userId: string; kind: NotificationKind; title: string; detail: string; createdAt: string; readAt?: string; }
export interface EnterpriseCollaborationStatus { initialized: boolean; offlineFirst: true; users: number; organizations: number; teams: number; sharedResources: number; activeLocks: number; activePresence: number; unreadNotifications: number; auditEvents: number; }