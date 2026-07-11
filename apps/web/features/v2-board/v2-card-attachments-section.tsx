"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, FileText, Paperclip, X } from "lucide-react";
import type { V2CardAttachment } from "@yadraw/shared";
import {
  deleteV2CardAttachment,
  getV2FileDownloadUrl,
  uploadV2CardAttachment,
} from "./api";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type V2CardAttachmentsSectionProps = {
  cardId: string;
  attachments: V2CardAttachment[] | undefined;
  isLoading: boolean;
  onLoad: (cardId: string) => Promise<V2CardAttachment[]>;
  onAttachmentsChange: (cardId: string, attachments: V2CardAttachment[]) => void;
  onPreview: (cardId: string, attachmentId: string) => void;
};

function formatFileSize(sizeBytes?: number | null): string {
  if (sizeBytes === null || sizeBytes === undefined) return "Unknown size";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function getAttachmentMeta(attachment: V2CardAttachment): string {
  const mimeType = attachment.mimeType || "unknown type";
  return `${mimeType} · ${formatFileSize(attachment.sizeBytes)}`;
}

export function V2CardAttachmentsSection({
  cardId,
  attachments,
  isLoading,
  onLoad,
  onAttachmentsChange,
  onPreview,
}: V2CardAttachmentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setError(null);

    onLoad(cardId)
      .catch(() => {
        if (!isActive) return;
        setError("Could not load files");
      });

    return () => {
      isActive = false;
    };
  }, [cardId, onLoad]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("File is larger than 25 MB");
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const attachment = await uploadV2CardAttachment(cardId, {
        file,
        role: "attachment",
      });
      onAttachmentsChange(cardId, [attachment, ...(attachments ?? [])]);
    } catch {
      setError("Could not attach file");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDetach(attachment: V2CardAttachment) {
    const shouldDetach = window.confirm("Remove this file from the card?");
    if (!shouldDetach) return;

    setDetachingId(attachment.id);
    setError(null);
    try {
      await deleteV2CardAttachment(cardId, attachment.id);
      onAttachmentsChange(
        cardId,
        (attachments ?? []).filter((item) => item.id !== attachment.id)
      );
    } catch {
      setError("Could not remove file");
    } finally {
      setDetachingId(null);
    }
  }

  async function handleDownload(attachment: V2CardAttachment) {
    setDownloadingId(attachment.id);
    setError(null);
    try {
      const response = await fetch(getV2FileDownloadUrl(attachment.fileId), {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error(`Download failed with ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="v2InspectorSection">
      <div className="v2InspectorSectionHeader">
        <h3>Files</h3>
        <button
          type="button"
          className="v2InspectorAttachButton"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Paperclip size={14} strokeWidth={2.2} />
          <span>{isUploading ? "Uploading..." : "Attach"}</span>
        </button>
        <input
          ref={fileInputRef}
          className="v2InspectorFileInput"
          type="file"
          onChange={(event) => void handleFileChange(event)}
        />
      </div>

      {isLoading ? (
        <p className="v2InspectorEmpty">Loading files...</p>
      ) : !attachments || attachments.length === 0 ? null : (
        <div className="v2InspectorAttachmentList">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="v2InspectorAttachmentRow">
              <span className="v2InspectorAttachmentIcon" aria-hidden="true">
                <FileText size={16} strokeWidth={2.1} />
              </span>
              <div className="v2InspectorAttachmentText">
                <button
                  type="button"
                  className="v2InspectorAttachmentPreviewButton"
                  title={attachment.filename}
                  onClick={() => onPreview(cardId, attachment.id)}
                >
                  {attachment.filename}
                </button>
                <span>{getAttachmentMeta(attachment)}</span>
                {attachment.processingStatus !== "processed" ? <em>{attachment.processingStatus}</em> : null}
              </div>
              <div className="v2InspectorAttachmentActions">
                <button
                  type="button"
                  aria-label={`Download ${attachment.filename}`}
                  onClick={() => void handleDownload(attachment)}
                  disabled={downloadingId === attachment.id}
                >
                  <Download size={14} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${attachment.filename}`}
                  onClick={() => void handleDetach(attachment)}
                  disabled={detachingId === attachment.id}
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <p className="v2InspectorAttachmentError">{error}</p> : null}
    </section>
  );
}
