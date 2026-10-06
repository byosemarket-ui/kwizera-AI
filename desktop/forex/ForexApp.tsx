import { ForexShell, exitForexToStudio } from "./ForexShell";
import type { DesktopPreferences } from "../desktop-polish/types";

export default function ForexApp({
  preferences,
  onThemeCycle,
  onNotificationsToggle,
  notificationsOpen,
  unreadCount,
  onBackToStudio = exitForexToStudio,
}: {
  preferences: DesktopPreferences;
  onThemeCycle: () => void;
  onNotificationsToggle: () => void;
  notificationsOpen: boolean;
  unreadCount: number;
  onBackToStudio?: () => void;
}) {
  return (
    <ForexShell
      preferences={preferences}
      onThemeCycle={onThemeCycle}
      onBackToStudio={onBackToStudio}
      onNotificationsToggle={onNotificationsToggle}
      notificationsOpen={notificationsOpen}
      unreadCount={unreadCount}
    />
  );
}
