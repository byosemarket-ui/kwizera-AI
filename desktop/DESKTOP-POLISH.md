# Desktop Polish

The desktop polish module finalizes interface-level personalization for the React desktop route. It is additive: it does not invoke AI generation, rendering, export, authentication, or any backend engine behavior.

## Scope

- Workspace profiles route the desktop to a focused starting workspace.
- Theme, accent, UI scale, font scale, high contrast, and reduced-motion preferences are applied at the document level.
- The shell remembers sidebar/layout state and stores a workspace snapshot for local restoration.
- Notification history, context menus, and drag/drop feedback are local desktop-interface behavior.
- Creative Editor dock widths and visibility remain owned by its existing local layout manager.

## Local Storage

| Key | Contents |
| --- | --- |
| `kwizera.desktop.preferences.v1` | Active profile and appearance/accessibility preferences. |
| `kwizera.desktop.notifications.v1` | Local desktop notification history. |
| `kwizera.desktop.workspace-backup.v1` | Latest workspace-layout and preference snapshot. |
| `kwizera.desktop-workspace.v1` | Existing shell layout state. |

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + K` | Open the workspace palette. |
| `Ctrl/Cmd + ,` | Open desktop preferences. |
| `Ctrl/Cmd + Shift + B` | Toggle the sidebar. |
| `Esc` | Close desktop overlays. |

## Files

- `desktop-polish/types.ts`: preference, profile, and notification contracts.
- `desktop-polish/preference-store.ts`: local persistence and snapshot helpers.
- `desktop-polish/profiles.ts`: profile-to-workspace mapping.
- `desktop-polish/desktop-polish.css`: overlay, theme, accessibility, focus, and responsive styling.

Browser window dimensions can be remembered as a desktop preference, but standard browser security rules prevent this interface from repositioning or resizing an operating-system window.