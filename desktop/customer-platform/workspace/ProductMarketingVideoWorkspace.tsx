import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useShell } from "../../shell/ShellContext";
import { productSetupEngine } from "../../product-setup/product-setup-engine";
import type { ProductSetupSnapshot } from "../../product-setup/types";
import { ACCEPT_ATTR, classifyFormat } from "../../product-intake/formats";
import { desktopPicksToFiles } from "../../product-intake/desktop-import";
import { usePmvWorkflow } from "../../pmv-workflow/usePmvWorkflow";
import { ServiceWorkspace } from "./ServiceWorkspace";
import { PmvProductStep } from "./pmv/PmvProductStep";
import { PmvStyleStep } from "./pmv/PmvStyleStep";
import { PmvCreateStep } from "./pmv/PmvCreateStep";
import { PmvResultStep } from "./pmv/PmvResultStep";
import {
  PMV_CUSTOMER_STEPS,
  initialStep,
  isVideoDelivered,
  reachableSteps,
  type PmvCustomerStep,
  type PmvViewInput,
} from "./pmv/view-model";
import "./product-marketing-video.css";

/**
 * Product Marketing Video — customer workspace.
 * Product → Style → Create → Preview → Final over the existing PMV engine and production workflow.
 */
export function ProductMarketingVideoWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<ProductSetupSnapshot>(() => productSetupEngine.snapshot());
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<PmvCustomerStep>("product");
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const initializedFor = useRef<string | null>(null);
  const previousStatus = useRef<string | null>(null);

  useEffect(() => {
    productSetupEngine.setServiceMode("pmv");
    productSetupEngine.setNotify(notify);
    const unsub = productSetupEngine.subscribe(setSnap);
    void productSetupEngine.hydrateFromServer().finally(() => {
      setHydrated(true);
      void productSetupEngine.refreshCreativeCapabilities();
      void productSetupEngine.refreshAudioLibrary();
    });
    return () => {
      unsub();
      productSetupEngine.setNotify(null);
      productSetupEngine.setServiceMode("standard");
    };
  }, [notify]);

  const flow = usePmvWorkflow(snap.projectId || null);
  const savedCount = snap.imageCards.filter((c) => c.uploadStatus === "saved").length;
  const uploadingCount = snap.imageCards.filter((c) => c.uploadStatus === "uploading").length;
  const cinematicCap = snap.creativeCapabilities.find((c) => c.mode === "CINEMATIC");
  const cinematicAvailable = cinematicCap ? cinematicCap.available : null;

  const view: PmvViewInput = useMemo(() => ({
    productName: snap.essentials.productName,
    savedPhotoCount: savedCount,
    uploadingPhotoCount: uploadingCount,
    generationMode: snap.creativeDirection.generationMode,
    cinematicAvailable,
    finalOutputUrl: snap.finalOutputUrl,
    deliveryStatus: snap.deliveryStatus,
    produceStatus: snap.produceStatus,
  }), [snap, savedCount, uploadingCount, cinematicAvailable]);

  const reachable = reachableSteps(flow.workflow, view);

  useEffect(() => {
    const key = snap.projectId ?? "";
    if (!hydrated || initializedFor.current === key) return;
    if (snap.projectId && !flow.loaded) return;
    initializedFor.current = key;
    setStep(initialStep(flow.workflow, view));
  }, [hydrated, flow.loaded, flow.workflow, snap.projectId, view]);

  useEffect(() => {
    const status = flow.workflow?.status ?? null;
    const wasActive = previousStatus.current === "RUNNING" || previousStatus.current === "QUEUED";
    previousStatus.current = status;
    if (wasActive && status === "COMPLETED") setStep("final");
  }, [flow.workflow?.status]);

  useEffect(() => {
    if (step === "final" && !isVideoDelivered(view) && flow.workflow?.status !== "COMPLETED") {
      setStep(view.finalOutputUrl ? "preview" : "create");
    }
  }, [step, view, flow.workflow?.status]);

  const showError = useCallback((message: string) => notify("error", "Something went wrong", message, "errors"), [notify]);

  const onFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const supported = [...files].filter((f) => classifyFormat(f) === "supported");
    if (!supported.length) {
      showError("Please use JPG, PNG, WEBP, TIFF or BMP photos.");
      return;
    }
    setBusy(true);
    try {
      await productSetupEngine.enqueueFiles(supported);
    } catch {
      showError("Your photos could not be uploaded. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [showError]);

  const pickImages = useCallback(async () => {
    const bridge = window.kwizeraDesktop;
    if (!bridge?.openProductImages) {
      fileRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      const result = await bridge.openProductImages();
      if (result.canceled) return;
      const { files, rejected } = desktopPicksToFiles(result.files);
      if (rejected.length) notify("warning", "Some files skipped", "Only supported photo formats were added.", "warnings");
      if (files.length) await onFiles(files);
    } finally {
      setBusy(false);
    }
  }, [notify, onFiles]);

  const go = (next: PmvCustomerStep) => {
    setStep(next);
    window.requestAnimationFrame(() => document.getElementById("pmv-steps")?.scrollIntoView({ block: "nearest" }));
  };

  return (
    <ServiceWorkspace
      meta={{
        serviceKey: "product-marketing-video",
        title: "Product Marketing Video",
        description: "Build a professional product video from your product photos and information.",
      }}
      phase="input"
      onBack={() => switchWorkspace("home")}
      onHelp={() => switchWorkspace("help")}
    >
      <div className="pmv" data-pmv-workspace="true" data-pmv-step={step}>
        <div className="pmv-topbar">
          <nav id="pmv-steps" className="pmv-steps" aria-label="Video steps">
            <ol>
              {PMV_CUSTOMER_STEPS.map((s, index) => {
                const currentIndex = PMV_CUSTOMER_STEPS.findIndex((x) => x.id === step);
                const active = s.id === step;
                const done = index < currentIndex;
                const enabled = reachable.has(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={[active ? "is-active" : "", done ? "is-done" : ""].filter(Boolean).join(" ") || undefined}
                      aria-current={active ? "step" : undefined}
                      disabled={!enabled}
                      onClick={() => go(s.id)}
                    >
                      <span className="pmv-steps__index" aria-hidden>{done ? <Check size={11} /> : index + 1}</span>
                      <span>{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <span className="pmv-save" data-state={snap.saveState} aria-live="polite">
            {snap.saveState === "saving" ? "Saving…" : snap.saveState === "saved" ? "Saved" : "Not saved yet"}
          </span>
        </div>

        {step === "product" ? (
          <PmvProductStep
            snap={snap}
            busy={busy}
            savedCount={savedCount}
            uploadingCount={uploadingCount}
            onAdd={() => void pickImages()}
            onAddFolder={() => folderRef.current?.click()}
            onFiles={(files) => void onFiles(files)}
            onContinue={() => go("style")}
            onError={showError}
          />
        ) : null}

        {step === "style" ? (
          <PmvStyleStep
            snap={snap}
            cinematicAvailable={cinematicAvailable}
            onBack={() => go("product")}
            onContinue={() => go("create")}
            onError={showError}
          />
        ) : null}

        {step === "create" ? (
          <PmvCreateStep
            snap={snap}
            view={view}
            flow={flow}
            cinematicAvailable={cinematicAvailable}
            onEditProduct={() => go("product")}
            onEditStyle={() => go("style")}
            onViewVideo={() => go(isVideoDelivered(view) ? "final" : "preview")}
          />
        ) : null}

        {step === "preview" || step === "final" ? (
          <PmvResultStep
            mode={step}
            snap={snap}
            view={view}
            flow={flow}
            onEdit={() => go("product")}
            onRegenerated={() => go("create")}
            onSaved={(ok) => (ok
              ? notify("success", "Project saved", "Your video project is saved.", "production-complete")
              : showError("Your project could not be saved. Please try again."))}
          />
        ) : null}

        <input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
        <input
          ref={folderRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          hidden
          {...({ webkitdirectory: "true", directory: "" } as object)}
          onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }}
        />
      </div>
    </ServiceWorkspace>
  );
}
