import { KEYBOARD_SHORTCUTS, QUICK_ACTIONS } from "../navigation/navigation-engine";

interface ShortcutGuideProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutGuide({ open, onClose }: ShortcutGuideProps) {
  if (!open) return null;

  return (
    <div className="ux-shortcut-backdrop" onMouseDown={onClose} role="presentation">
      <section
        className="ux-shortcut-guide"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcut guide"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>PRODUCTIVITY</span>
            <h2>Shortcut guide</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close shortcut guide">Close</button>
        </header>
        <div className="ux-shortcut-grid">
          <section>
            <h3>Workspace</h3>
            <ul>
              {KEYBOARD_SHORTCUTS.map((item) => (
                <li key={item.keys}>
                  <kbd>{item.keys}</kbd>
                  <span>{item.detail}</span>
                </li>
              ))}
              <li><kbd>Ctrl+Shift+L</kbd><span>Layout manager</span></li>
              <li><kbd>Ctrl+Z</kbd><span>Undo last workspace change</span></li>
              <li><kbd>Ctrl+Shift+Z</kbd><span>Redo</span></li>
              <li><kbd>?</kbd><span>Open this guide</span></li>
            </ul>
          </section>
          <section>
            <h3>Quick actions</h3>
            <ul>
              {QUICK_ACTIONS.filter((a) => a.shortcut).map((action) => (
                <li key={action.id}>
                  <kbd>{action.shortcut}</kbd>
                  <span>{action.label} — {action.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
