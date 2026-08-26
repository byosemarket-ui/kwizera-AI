# KWIZERA AI STUDIO — Production Guide (Phase 7)

**Version:** see root `package.json` (authoritative).  
**Platform:** Windows 10/11 x64, Node.js ≥ 20 for source/dev launches.

## 1. Installation

1. Build or obtain `release/KwizeraAIStudio-Setup-<version>.exe`.
2. Run the Setup EXE (NSIS). Choose an install directory under Program Files if preferred.
3. User data is **not** stored in the install directory — it uses `KWIZERA_STORAGE_ROOT` or `%LOCALAPPDATA%\KWIZERA-AI-STUDIO` (preferred `D:\KWIZERA-AI-STUDIO` when available).

From a source checkout with an existing pack:

```bat
npm run install:shortcuts
```

Or double-click the Desktop / Start Menu shortcut after install.

## 2. First launch

1. Launcher / Electron starts.
2. Local API starts or is reused on `127.0.0.1:<port>` (default 5173).
3. Splash shows real health checks.
4. Workspace opens at `/desktop/`.

Initialization creates required folders under the storage root. Existing user data is not wiped.

## 3. Desktop shortcut / Start Menu

- NSIS creates shortcuts named **KWIZERA AI STUDIO**.
- Dev/source: `npm run install:shortcuts` → Desktop + Start Menu → unpacked EXE or `launch-kwizera-desktop.bat`.

## 4. Application startup

```
Windows → Launcher → Config → Storage → Local API → Health → System Health Center → Desktop UI
```

Internet is optional. Offline: local memory/knowledge/projects continue.

## 5–7. Project creation / product upload / production

1. Open **New Project** / Product Input.
2. Upload product images.
3. Complete product information and analysis workspaces.
4. Configure Marketing.
5. Use Production Pipeline / Queue / Command Center.
6. Preview outputs under Outputs / History.

Full creative pipeline requires `KWIZERA_PERSISTENT_MODE=1` and available local AI models.

## 8. Offline mode

Disconnect network. Application must still start. Online Knowledge shows OFFLINE; local knowledge remains searchable.

## 9. Online knowledge

Knowledge Center → Online Research. Sources are allowlisted; content is treated as untrusted DATA (injection patterns flagged; never executed as commands).

## 10. Health monitoring

Settings → **System Health**: score, subsystems, services, safe repair, update foundation, diagnostics, support bundle.

## 11. Backup

System Health → repair `create-safety-backup`, or API `POST /api/persistent-memory/backup`. Backups live under `{storageRoot}/backups`.

## 12. Recovery

Interrupted-session marker on unclean exit. Acknowledge in System Health. Production resume uses existing pipeline checkpoints when available.

## 13. Update

Preferred: install a new validated Setup EXE after `POST /api/system-health/update/backup`. Untrusted URLs are rejected. Automatic silent update download is not enabled.

## 14. Troubleshooting

| Symptom | Action |
|---------|--------|
| Port in use | Change port in desktop config / `KWIZERA_DEV_PORT`; do not kill unknown processes |
| Storage missing | Set `KWIZERA_STORAGE_ROOT` to a writable path |
| AI not ready | Enable persistent mode; check models; System Health → AI Engine |
| Repair denied | Only allowlisted repairs run — by design |
| Logs | `{storageRoot}/logs/` and System Health → diagnostic / support bundle |

Uninstall does **not** delete projects, memory, knowledge, or backups (`deleteAppDataOnUninstall: false`).
