# Business Intelligence Center And Analytics Platform

Business Intelligence Center is a dedicated desktop workspace for executive analytics presentation. It adds no calculations, predictions, cloud analytics, or engine behavior. It consumes only the existing read-only desktop status and workspace endpoints to make the presentation layer live-ready.

## Workspace Surfaces

- Executive dashboard: business, AI, project, marketing, productivity, and system-status panels.
- Analytics dashboard: future-ready KPI widgets for project, creative, AI, marketing, storage, and resource metrics.
- Reports center: category filtering, text search, local favorites, and recent-report history.
- AI recommendations: explicit placeholder recommendations for workflow, creative, marketing, performance, resources, and productivity.
- Analytics timeline: daily, weekly, and monthly visualization foundations with project, AI, and marketing event lanes.
- Resource dashboard: CPU, GPU, RAM, storage, AI engine, rendering queue, automation, and communication-bus status surfaces.

## Integration And Refresh

The workspace reads `GET /api/desktop-workspace/status` and `GET /api/workspace` on entry and every 15 seconds. Existing project records supply project and source-asset counts plus storage usage. Runtime readiness supplies AI Core, workflow, automation, communication bus, memory, and knowledge status. All unavailable values are visibly labelled `Not sampled`, `Standby`, or `--`.

## Persistence

`BusinessIntelligenceManager` stores local widget visibility/density, active BI view, timeline period, report category, report favorites, and recent reports under `kwizera.business-intelligence.v1`.

## Extension Points

`intelligence-store.ts` defines the Business Intelligence Manager plus named presentation-layer extension points for Analytics Dashboard, Executive Dashboard, Report, KPI Analytics, Productivity Analytics, Project Analytics, Marketing Analytics, Creative Analytics, AI Performance Analytics, Resource Analytics, Recommendations, Search, Export Foundation, and Workspace Synchronization.

## Scope Boundary

This workspace does not perform financial accounting, payment processing, AI prediction, machine-learning analytics, cloud analytics, authentication, rendering, or business calculations. It does not modify the Business Dashboard, Brand Center, Marketing Workspace, Desktop Workspace, Project Workspace, AI Studio, AI Core, Workflow Engine, Communication Bus, Memory Foundation, Knowledge Foundation, or project-management engine.