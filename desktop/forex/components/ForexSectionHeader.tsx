export function ForexSectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="fx-section-header">
      {eyebrow ? <p className="fx-eyebrow">{eyebrow}</p> : null}
      <h1 className="fx-page-title">{title}</h1>
      {description ? <p className="fx-page-desc">{description}</p> : null}
    </header>
  );
}
