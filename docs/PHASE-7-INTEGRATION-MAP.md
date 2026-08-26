# Phase 7 — Integration Map

```
WINDOWS
  │
  ├─ Desktop / Start Menu shortcut
  │     → launch-kwizera-desktop.bat  OR  win-unpacked / Setup install EXE
  │
  ▼
ELECTRON (electron/main.mjs)
  │  loadDesktopConfig · ensure dirs · spawn/reuse API · splash health · open /desktop/
  │
  ▼
LOCAL API (dev/server/index.ts)  127.0.0.1
  │
  ├─ System Health Center ────────── /api/system-health/*
  │     ├── Database dir · Storage · Projects · Outputs
  │     ├── Memory / Knowledge (PMC)
  │     ├── AI status (desktop-workspace)
  │     ├── Network (Online Knowledge Engine)
  │     ├── Safe repair allowlist · Update foundation · Crash marker
  │
  ├─ Persistent Memory Center ────── /api/persistent-memory/* · /api/persistent-knowledge/*
  ├─ Online Knowledge Engine ─────── /api/online-knowledge/*
  ├─ Workspace / Pipeline* ───────── /api/workspace/* · /api/pipeline/* (* needs persistent mode)
  └─ Product / Marketing / Creative APIs
        │
        ▼
DESKTOP UI (desktop/)
  ├── Product Input → Intelligence → Marketing → Production → Preview → Outputs → History
  ├── Knowledge Center · AI Assistant · Resource awareness
  └── System Health (certification visibility)
```

**User data** stays under `KWIZERA_STORAGE_ROOT`. **Application files** live in install/resources. No duplicate Memory/Knowledge/Database engines.
