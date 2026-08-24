import { cloneElement, isValidElement, type ReactElement } from "react";
import { formatTooltipText, getTooltip } from "./tooltip-registry";

interface SmartTooltipProps {
  tipId: string;
  children: ReactElement;
  enabled?: boolean;
}

/** Enhances a child with accessible rich tooltip content (purpose/usage/result). */
export function SmartTooltip({ tipId, children, enabled = true }: SmartTooltipProps) {
  const spec = getTooltip(tipId);
  if (!enabled || !spec || !isValidElement(children)) return children;

  const label = formatTooltipText(spec);
  const child = cloneElement(children as ReactElement<Record<string, unknown>>, {
    title: (children.props as { title?: string }).title || label,
    "aria-description": label,
  });

  return (
    <span className="ux-tooltip-wrap" data-tip-id={tipId}>
      {child}
      <span className="ux-tooltip-panel" role="tooltip">
        <strong>{spec.purpose}</strong>
        <em>{spec.usage}</em>
        <span>Result: {spec.expectedResult}</span>
        {spec.shortcut && <kbd>{spec.shortcut}</kbd>}
      </span>
    </span>
  );
}

export function useSmartTitle(tipId: string, enabled = true): string | undefined {
  const spec = getTooltip(tipId);
  if (!enabled || !spec) return undefined;
  return formatTooltipText(spec);
}
