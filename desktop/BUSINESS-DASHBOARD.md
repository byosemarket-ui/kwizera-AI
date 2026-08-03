# Business Dashboard Foundation

The Business Dashboard is the desktop dashboard route's modular, read-only control surface. It replaces the former static welcome panel without changing the Desktop Workspace, Project Workspace, AI Studio, Creative Editor, AI Core, workflow engine, or any other engine.

## Interfaces

- Business overview: KPI placeholders plus the available local project count and source-asset storage total.
- AI overview: status indicators sourced only from `GET /api/desktop-workspace/status`.
- Recent projects and activity: project metadata sourced only from `GET /api/workspace`.
- System health: readiness indicators and explicitly labelled unsampled resource placeholders.
- Notification center: local dashboard status messages prepared for future event sources.
- Quick actions: desktop navigation only; they never execute generation, rendering, export, or workflow actions.

## Persistence and Refresh

`DashboardLayoutManager` stores widget visibility and compact/expanded density under `kwizera.business-dashboard.layout.v1`. The dashboard refreshes its read-only endpoint data on entry and every 15 seconds; the Refresh control performs the same read-only synchronization on demand.

## Managers

`dashboard-manager.ts` defines extension points for the Business Dashboard Manager, Widget Manager, Dashboard Navigation Manager, KPI Widget Engine, Activity Feed Manager, Recent Project Manager, AI Status Dashboard, System Health Dashboard, Notification Dashboard, Quick Action Manager, and Dashboard Personalization Manager. They are intentionally presentation-layer helpers, ready for later live-data adapters.

## Scope Boundary

This foundation does not calculate business metrics, invoke AI generation, render media, export artifacts, authenticate users, use cloud services, or manage customers. Resource values without a valid current source remain visibly marked as placeholders or unsampled.