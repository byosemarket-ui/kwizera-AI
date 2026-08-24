import { AlertTriangle, Bell, CheckCircle2, Info, Sparkles, X, XCircle } from "lucide-react";
import type { DesktopNotification, NotificationCategory } from "../../desktop-polish/types";

const categoryMeta: Record<NotificationCategory, { label: string; icon: typeof Info }> = {
  information: { label: "Information", icon: Info },
  warnings: { label: "Warnings", icon: AlertTriangle },
  errors: { label: "Errors", icon: XCircle },
  "production-complete": { label: "Production Complete", icon: CheckCircle2 },
  updates: { label: "Updates", icon: Bell },
  "ai-suggestions": { label: "AI Suggestions", icon: Sparkles },
};

interface NotificationCenterProps {
  notifications: DesktopNotification[];
  onClear: () => void;
  onClose: () => void;
  onMarkRead?: (id: string) => void;
}

export function NotificationCenter({ notifications, onClear, onClose, onMarkRead }: NotificationCenterProps) {
  const entries = notifications.length
    ? notifications
    : [{
        id: "welcome",
        tone: "info" as const,
        category: "information" as const,
        title: "Navigation engine ready",
        detail: "Header, sidebar, search, and quick actions are active.",
        createdAt: new Date().toISOString(),
        read: true,
      }];

  const grouped = groupByCategory(entries);

  return (
    <aside className="desktop-notifications nav-notification-center" aria-label="Notification center">
      <header>
        <div>
          <span>NOTIFICATION CENTER</span>
          <h2>Desktop activity</h2>
        </div>
        <button onClick={onClose} title="Close notifications"><X size={16} /></button>
      </header>
      <div className="notification-body">
        {(Object.keys(grouped) as NotificationCategory[]).map((category) => {
          const items = grouped[category];
          if (!items?.length) return null;
          const meta = categoryMeta[category];
          const Icon = meta.icon;
          return (
            <section key={category} className="notification-group">
              <h3><Icon size={13} />{meta.label}</h3>
              {items.map((item) => (
                <article key={item.id} className={item.read ? "read" : "unread"} onClick={() => onMarkRead?.(item.id)}>
                  <i className={item.tone} />
                  <div>
                    <b>{item.title}</b>
                    <p>{item.detail}</p>
                    <small>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
      <footer><button onClick={onClear}>Clear history</button></footer>
    </aside>
  );
}

function groupByCategory(entries: DesktopNotification[]): Partial<Record<NotificationCategory, DesktopNotification[]>> {
  const result: Partial<Record<NotificationCategory, DesktopNotification[]>> = {};
  for (const entry of entries) {
    const category = entry.category ?? "information";
    result[category] = [...(result[category] ?? []), entry];
  }
  return result;
}
