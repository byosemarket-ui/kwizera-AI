import type { ReactNode } from "react";
import { ArrowLeft, HelpCircle } from "lucide-react";
import type { ServiceWorkspaceMeta, ServiceWorkspacePhase, ServiceWorkspaceStep } from "./types";
import { PrimaryButton, SecondaryButton, EmptyState, ErrorState, LoadingState } from "../components/ui";

export function ServiceWorkspace({
  meta,
  steps,
  currentStepId,
  phase = "input",
  errorMessage,
  onBack,
  onHelp,
  onCancel,
  onPrimary,
  primaryLabel = "Continue",
  primaryDisabled,
  primaryBusy,
  cancelLabel = "Cancel",
  children,
  preview,
  footerNote,
}: {
  meta: ServiceWorkspaceMeta;
  steps?: ServiceWorkspaceStep[];
  currentStepId?: string;
  phase?: ServiceWorkspacePhase;
  errorMessage?: string;
  onBack: () => void;
  onHelp?: () => void;
  onCancel?: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  cancelLabel?: string;
  children: ReactNode;
  preview?: ReactNode;
  footerNote?: string;
}) {
  const stepIndex = steps?.findIndex((step) => step.id === currentStepId) ?? -1;

  return (
    <section
      className="cp-service-workspace"
      data-customer-service-workspace="true"
      data-service-key={meta.serviceKey}
      data-workspace-phase={phase}
      aria-label={`${meta.title} workspace`}
    >
      <header className="cp-sw-header">
        <button type="button" className="cp-sw-back" onClick={onBack} aria-label="Back to Home">
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Back</span>
        </button>
        <div className="cp-sw-title-block">
          <p className="cp-label">Create</p>
          <h1 className="cp-sw-title">{meta.title}</h1>
          <p className="cp-body">{meta.description}</p>
        </div>
        {onHelp ? (
          <button type="button" className="cp-icon-button" onClick={onHelp} aria-label="Help" title="Help">
            <HelpCircle size={18} />
          </button>
        ) : null}
      </header>

      {steps && steps.length > 0 ? (
        <nav className="cp-sw-steps" aria-label="Workspace steps">
          <ol>
            {steps.map((step, index) => {
              const active = step.id === currentStepId;
              const done = stepIndex >= 0 && index < stepIndex;
              return (
                <li
                  key={step.id}
                  className={[active ? "is-active" : "", done ? "is-done" : ""].filter(Boolean).join(" ")}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="cp-sw-step-index" aria-hidden="true">{index + 1}</span>
                  <span className="cp-sw-step-label">{step.label}</span>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      {phase === "error" && errorMessage ? (
        <ErrorState
          title="Something went wrong"
          detail={errorMessage}
          onRetry={onPrimary}
        />
      ) : null}

      {phase === "processing" || phase === "saving" ? (
        <LoadingState
          label={
            phase === "saving"
              ? "Saving…"
              : "Working on your project…"
          }
        />
      ) : null}

      <div className={`cp-sw-body ${preview ? "has-preview" : ""}`}>
        <div className="cp-sw-main" data-workspace-panel="input">
          {phase === "idle" ? (
            <EmptyState title="Ready when you are" detail="Start by adding content below." />
          ) : (
            children
          )}
        </div>
        {preview ? (
          <aside className="cp-sw-preview" data-workspace-panel="preview" aria-label="Preview">
            {preview}
          </aside>
        ) : null}
      </div>

      {(onCancel || onPrimary) ? (
        <footer className="cp-sw-actions">
          {footerNote ? <p className="cp-caption">{footerNote}</p> : <span />}
          <div className="cp-sw-action-buttons">
            {onCancel ? (
              <SecondaryButton onClick={onCancel} disabled={primaryBusy}>
                {cancelLabel}
              </SecondaryButton>
            ) : null}
            {onPrimary ? (
              <PrimaryButton onClick={onPrimary} disabled={primaryDisabled || primaryBusy}>
                {primaryBusy ? "Please wait…" : primaryLabel}
              </PrimaryButton>
            ) : null}
          </div>
        </footer>
      ) : null}
    </section>
  );
}
