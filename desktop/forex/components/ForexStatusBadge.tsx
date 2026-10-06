export function ForexStatusBadge({
  tone,
  children,
}: {
  tone: "live" | "future" | "offline";
  children: string;
}) {
  return (
    <span className={`fx-status-badge tone-${tone}`}>
      {children}
    </span>
  );
}
