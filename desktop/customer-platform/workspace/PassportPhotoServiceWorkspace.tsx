import { useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { useShell } from "../../shell/ShellContext";
import { EmptyState, PrimaryButton, SecondaryButton, StatusBadge } from "../components/ui";
import { ServiceWorkspace } from "./ServiceWorkspace";
import { PASSPORT_SERVICE_STEPS } from "./types";

/**
 * Passport Photo workspace architecture.
 * Upload is available as a local preview staging step.
 * Camera capture and compliance processing remain Coming Soon — no fake engines.
 */
export function PassportPhotoServiceWorkspace() {
  const { switchWorkspace, notify } = useShell();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("error", "Unsupported file", "Please choose a photo image (JPG, PNG, or WEBP).", "errors");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
  };

  return (
    <ServiceWorkspace
      meta={{
        serviceKey: "passport-photo",
        title: "Passport Photo",
        description: "Create a clean passport-ready photo. Processing tools are coming soon.",
      }}
      steps={PASSPORT_SERVICE_STEPS}
      currentStepId="capture"
      phase="input"
      onBack={() => switchWorkspace("home")}
      onHelp={() => switchWorkspace("help")}
      onCancel={() => switchWorkspace("home")}
      cancelLabel="Back to Home"
      footerNote="Passport formatting and compliance checks are not available yet."
      preview={
        previewUrl ? (
          <figure className="cp-sw-preview-figure">
            <img src={previewUrl} alt={fileName ? `Selected photo ${fileName}` : "Selected passport photo preview"} />
            <figcaption className="cp-caption">{fileName}</figcaption>
          </figure>
        ) : (
          <EmptyState title="No photo yet" detail="Upload a photo to preview it here." />
        )
      }
    >
      <div className="cp-sw-coming-panel">
        <StatusBadge status="COMING_SOON" />
        <h2 className="cp-section-title">Add your photo</h2>
        <p className="cp-body">
          Upload a clear head-and-shoulders photo to get started. Camera capture and automatic passport formatting are coming soon.
        </p>
        <div className="cp-actions">
          <PrimaryButton onClick={() => inputRef.current?.click()}>
            <span className="cp-sw-inline-icon"><Upload size={16} aria-hidden="true" /></span>
            Upload Photo
          </PrimaryButton>
          <SecondaryButton disabled>
            <span className="cp-sw-inline-icon"><Camera size={16} aria-hidden="true" /></span>
            Camera — Coming Soon
          </SecondaryButton>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="cp-sr-only"
          aria-label="Upload passport photo"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        <ul className="cp-sw-soon-list" aria-label="Upcoming passport steps">
          <li>Crop and position — Coming soon</li>
          <li>Background cleanup — Coming soon</li>
          <li>Official size and format — Coming soon</li>
          <li>Save and download — Coming soon</li>
        </ul>
      </div>
    </ServiceWorkspace>
  );
}
