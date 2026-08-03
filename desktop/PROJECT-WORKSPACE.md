# Project Workspace and Asset Management

The Project Workspace is a React/TypeScript desktop surface mounted from the existing `/desktop/` application.

## Scope

- Reads persisted projects and product-image metadata from `GET /api/workspace`.
- Creates and opens projects only through the existing Project Management API; no project-engine behavior is implemented here.
- Builds a client-side asset index through `AssetIndexManager`.
- Synchronizes read-only workspace data every 15 seconds.
- Persists asset favorites and recent-file history in browser local storage.
- Provides project tree navigation, breadcrumbs/history, search, filters, grid/list views, multiselect, drag/drop affordance, previews, and metadata.

Management controls such as rename, copy, move, delete, tags, and import are intentionally visual-only. This step does not create generated media, render, export, or use cloud storage.

## Architecture

- `project-workspace/types.ts`: data contracts for workspace projects and indexed assets.
- `project-workspace/asset-index.ts`: maps existing persisted product images into scalable asset records.
- `project-workspace/ProjectWorkspace.tsx`: explorer, browser, preview, filter, search, history, and synchronization UI.
- `project-workspace/project-workspace.css`: responsive desktop styling.

The workspace inherits AI Core, Project Management, Memory Foundation, Knowledge Foundation, Workflow Engine, and Communication Bus readiness from the existing Desktop Workspace Foundation status surface. It does not modify those systems.

## Build

```powershell
npm install
npm run build:desktop
npm run dev
```

Open `http://127.0.0.1:5173/desktop/`, then use **Projects** or **Media Library** in the workspace navigation.