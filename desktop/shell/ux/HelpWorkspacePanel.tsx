import { useMemo, useState } from "react";
import { Award, BookOpen, Keyboard, Route, Sparkles } from "lucide-react";
import { uxEngine } from "./ux-engine";
import { KEYBOARD_SHORTCUTS } from "../navigation/navigation-engine";
import { workspaceCertificationEngine } from "../certification/certification-engine";

interface HelpWorkspacePanelProps {
  onOpenAiMe?: () => void;
  onStartTour?: () => void;
  onOpenShortcuts?: () => void;
}

export function HelpWorkspacePanel({ onOpenAiMe, onStartTour, onOpenShortcuts }: HelpWorkspacePanelProps) {
  const productivity = useMemo(() => uxEngine.getProductivity(), []);
  const [tourDone, setTourDone] = useState(() => uxEngine.isTourCompleted());
  const cert = useMemo(() => workspaceCertificationEngine.getSnapshot() ?? workspaceCertificationEngine.run(), []);

  return (
    <div className="ux-help-panel">
      <header>
        <BookOpen size={28} />
        <div>
          <span className="sidebar-caption">Help System</span>
          <h2>Accessibility & productivity</h2>
          <p>Keyboard-first navigation, confirmations, undo/redo, and guided workflows — offline and single-user.</p>
        </div>
      </header>

      <section className={`foundation-cert-card ${cert.certified ? "is-certified" : "is-review"}`}>
        <Award size={22} />
        <div>
          <span className="sidebar-caption">Foundation {cert.version}</span>
          <h3>{cert.certified ? "Certified for professional product creation" : "Certification review required"}</h3>
          <p>
            Overall {cert.overallScore}/100 · Stability {cert.stabilityScore} · Performance {cert.performanceScore} · UX {cert.uxScore}
          </p>
          <p className="foundation-cert-detail">{cert.readinessExplanation}</p>
        </div>
      </section>

      <div className="ux-help-actions">
        <button type="button" className="soft-button" onClick={onOpenShortcuts}>
          <Keyboard size={15} /> Shortcut guide
        </button>
        <button
          type="button"
          className="soft-button"
          onClick={() => {
            onStartTour?.();
            uxEngine.markTourCompleted();
            setTourDone(true);
            uxEngine.announce("Workspace tour marked complete. Ask AI Me for the next step.", "success");
          }}
        >
          <Route size={15} /> {tourDone ? "Replay tour tips" : "Start workspace tour"}
        </button>
        <button type="button" className="soft-button" onClick={onOpenAiMe}>
          <Sparkles size={15} /> Ask AI Me
        </button>
      </div>

      <section>
        <h3>Essential shortcuts</h3>
        <ul className="ux-help-list">
          {KEYBOARD_SHORTCUTS.slice(0, 6).map((item) => (
            <li key={item.keys}><kbd>{item.keys}</kbd> {item.detail}</li>
          ))}
          <li><kbd>Ctrl+Z</kbd> Undo · <kbd>Ctrl+Shift+Z</kbd> Redo · <kbd>?</kbd> Shortcut guide</li>
        </ul>
      </section>

      <section>
        <h3>Smart recommendations</h3>
        <ul className="ux-help-list">
          {productivity.recommendations.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {uxEngine.getTourSteps().slice(0, 3).map((step) => (
            <li key={step.id}><b>{step.title}:</b> {step.body}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Accessibility</h3>
        <p>
          Use Tab / Shift+Tab for keyboard-only navigation. High contrast, font scale, and reduced motion
          live in Preferences (Ctrl+,). Focus rings stay visible in keyboard mode.
        </p>
      </section>
    </div>
  );
}
