"use client";

import { ChevronLeft, ChevronRight, Download, FileQuestion, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { V2CardAttachment } from "@yadraw/shared";
import { getV2FileDownloadUrl } from "./api";
import { useDialogFocus } from "./use-dialog-focus";

type PreviewKind = "image" | "pdf" | "video" | "text" | "download";

function previewKind(attachment: V2CardAttachment): PreviewKind {
  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  const filename = attachment.filename.toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || filename.endsWith(".pdf")) return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (
    mimeType.startsWith("text/") ||
    ["application/json", "application/xml", "application/javascript"].includes(mimeType) ||
    /\.(txt|md|json|csv|log|xml|ya?ml|js|ts|tsx|jsx|css|html?)$/.test(filename)
  ) {
    return "text";
  }
  return "download";
}

function triggerDownload(attachment: V2CardAttachment) {
  const link = document.createElement("a");
  link.href = getV2FileDownloadUrl(attachment.fileId);
  link.download = attachment.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

type V2FilePreviewModalProps = {
  attachments: V2CardAttachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export function V2FilePreviewModal({
  attachments,
  index,
  onIndexChange,
  onClose,
}: V2FilePreviewModalProps) {
  const attachment = attachments[index];
  const kind = useMemo(() => (attachment ? previewKind(attachment) : "download"), [attachment]);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, onClose);

  useEffect(() => {
    setObjectUrl(null);
    setTextContent(null);
    setError(null);
    if (!attachment || kind === "download") {
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    let url: string | null = null;
    setIsLoading(true);

    fetch(getV2FileDownloadUrl(attachment.fileId), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Preview failed with ${response.status}`);
        return response.blob();
      })
      .then(async (blob) => {
        if (controller.signal.aborted) return;
        if (kind === "text") {
          const content = await blob.text();
          if (!controller.signal.aborted) setTextContent(content);
          return;
        }
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        console.error("File preview failed:", loadError);
        setError("Preview could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment, kind]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (event.key === "ArrowRight" && index < attachments.length - 1) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [attachments.length, index, onClose, onIndexChange]);

  if (!attachment) return null;

  return (
    <div className="v2FilePreviewBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="v2FilePreviewModal"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${attachment.filename}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="v2FilePreviewHeader">
          <div>
            <strong title={attachment.filename}>{attachment.filename}</strong>
            <span>{index + 1} of {attachments.length}</span>
          </div>
          <button type="button" onClick={() => triggerDownload(attachment)} aria-label="Download file">
            <Download size={18} />
          </button>
          <button type="button" onClick={onClose} aria-label="Close preview">
            <X size={19} />
          </button>
        </header>

        <div className="v2FilePreviewContent">
          {isLoading ? <p>Loading preview...</p> : null}
          {error ? <p className="v2FilePreviewError">{error}</p> : null}
          {!isLoading && !error && kind === "image" && objectUrl ? (
            <img src={objectUrl} alt={attachment.filename} />
          ) : null}
          {!isLoading && !error && kind === "pdf" && objectUrl ? (
            <iframe src={objectUrl} title={attachment.filename} />
          ) : null}
          {!isLoading && !error && kind === "video" && objectUrl ? (
            <video src={objectUrl} controls autoPlay />
          ) : null}
          {!isLoading && !error && kind === "text" && textContent !== null ? (
            <pre>{textContent}</pre>
          ) : null}
          {kind === "download" ? (
            <div className="v2FilePreviewFallback">
              <FileQuestion size={42} />
              <p>This file type cannot be previewed.</p>
              <button type="button" onClick={() => triggerDownload(attachment)}>
                <Download size={17} /> Download
              </button>
            </div>
          ) : null}
        </div>

        {attachments.length > 1 ? (
          <>
            <button
              type="button"
              className="v2FilePreviewNav v2FilePreviewNavPrevious"
              onClick={() => onIndexChange(index - 1)}
              disabled={index === 0}
              aria-label="Previous file"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              className="v2FilePreviewNav v2FilePreviewNavNext"
              onClick={() => onIndexChange(index + 1)}
              disabled={index === attachments.length - 1}
              aria-label="Next file"
            >
              <ChevronRight size={24} />
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}
