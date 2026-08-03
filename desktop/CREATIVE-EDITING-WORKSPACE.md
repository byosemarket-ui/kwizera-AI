# Professional Creative Editing Workspace

The Creative Editor is a React and TypeScript interface available from the **Creative Editor** route in the desktop workspace.

## Scope

- Provides live preview states using the active Project Workspace product image when available.
- Provides scene navigation, layer selection, timeline navigation, camera placeholders, and a properties inspector.
- Persists dock visibility and scene/inspector panel widths in browser local storage.
- Synchronizes active project media and read-only runtime integration status every 15 seconds.
- Exposes readiness indicators for Desktop Workspace, Project Workspace, AI Core, Workflow Engine, Communication Bus, Product Intelligence, existing Video/Camera Intelligence, Memory Foundation, and Knowledge Foundation.

The timeline, camera, properties, and layers are UI foundations only. The editor does not render, generate media, alter assets, run AI processing, or modify any existing engine.

## Modules

- `desktop/creative-editor/types.ts`: editor data contracts.
- `desktop/creative-editor/layout-store.ts`: persisted panel visibility and sizing manager.
- `desktop/creative-editor/CreativeEditingWorkspace.tsx`: scene, timeline, preview, layer, and inspector components.
- `desktop/creative-editor/creative-editor.css`: responsive editor layout and panel styling.

## Build

```powershell
npm install
npm run build:desktop
npm run dev
```

Open `http://127.0.0.1:5173/desktop/` and select **Creative Editor**.