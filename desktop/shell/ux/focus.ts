export function trapFocus(container: HTMLElement): () => void {
  const selector = [
    "a[href]", "button:not([disabled])", "textarea:not([disabled])",
    "input:not([disabled])", "select:not([disabled])", "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  const focusable = () => Array.from(container.querySelectorAll<HTMLElement>(selector))
    .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

  const doc = typeof document !== "undefined" ? document : null;
  const previously = (doc?.activeElement as HTMLElement | null) ?? null;
  const nodes = focusable();
  nodes[0]?.focus?.();

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = doc?.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener("keydown", onKeyDown);
  return () => {
    container.removeEventListener("keydown", onKeyDown);
    previously?.focus?.();
  };
}

export function ensureSkipLink(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("kwizera-skip-main")) return;
  const link = document.createElement("a");
  link.id = "kwizera-skip-main";
  link.href = "#workspace-main";
  link.className = "ux-skip-link";
  link.textContent = "Skip to production workspace";
  document.body.prepend(link);
}

export function applyFocusMode(mode: "mouse" | "keyboard"): void {
  document.documentElement.dataset.focusMode = mode;
}

export function installFocusModeListeners(): () => void {
  const toKeyboard = (event: KeyboardEvent) => {
    if (event.key === "Tab") applyFocusMode("keyboard");
  };
  const toMouse = () => applyFocusMode("mouse");
  window.addEventListener("keydown", toKeyboard);
  window.addEventListener("mousedown", toMouse);
  return () => {
    window.removeEventListener("keydown", toKeyboard);
    window.removeEventListener("mousedown", toMouse);
  };
}
