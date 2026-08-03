# AI Studio Workspace and Interaction Center

The AI Studio is a React and TypeScript collaboration interface inside the existing desktop workspace. It is available from the **AI Studio** route at `/desktop/`.

## Scope

- Persists collaboration sessions and conversation history in browser local storage.
- Supports session creation and switching, automatic conversation scrolling, and in-session search.
- Polls `GET /api/desktop-workspace/status` every 15 seconds for read-only context synchronization.
- Displays AI Core, Workflow Engine, Communication Bus, Memory Foundation, Knowledge Foundation, Automation Engine, Task Scheduler, and active Project Workspace status.
- Includes prepared activity, progress, recommendation, decision timeline, and notification surfaces.

The assistant response after a user message is an explicit local interface acknowledgment. It does not invoke a model, task, workflow, generation, rendering, export, or other business operation.

## Modules

- `desktop/ai-studio/types.ts`: typed workspace contracts.
- `desktop/ai-studio/session-store.ts`: local AI session and conversation history manager.
- `desktop/ai-studio/AiStudioWorkspace.tsx`: reusable UI composition and synchronization behavior.
- `desktop/ai-studio/ai-studio.css`: responsive AI Studio styling.

## Build

```powershell
npm install
npm run build:desktop
npm run dev
```

Open `http://127.0.0.1:5173/desktop/` and select **AI Studio**.