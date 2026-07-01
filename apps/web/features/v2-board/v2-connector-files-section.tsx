"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, FileText, Paperclip, X } from "lucide-react";
import type { V2ConnectionAttachment } from "@yadraw/shared";
import {
  deleteV2ConnectionAttachment,
  getV2FileDownloadUrl,
  listV2ConnectionAttachments,
  uploadV2ConnectionAttachment,
} from "./api";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type V2ConnectorFilesSectionProps = {
  connectionId: string;
};

function formatFileSize(sizeBytes?: number | null): string {
  if (sizeBytes === null || sizeBytes === undefined) return "Unknown size";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function getAttachmentMeta(attachment: V2ConnectionAttachment): string {
  const mimeType = attachment.mimeType || "unknown type";
  return `${mimeType} · ${formatFileSize(attachment.sizeBytes)}`;
}

export function V2ConnectorFilesSection({
  connectionId,
}: V2ConnectorFilesSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<V2ConnectionAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError(null);

    listV2ConnectionAttachments(connectionId)
      .then((items) => {
        if (!isActive) return;
        setAttachments(items);
      })
      .catch(() => {
        if (!isActive) return;
        setAttachments([]);
        setError("Could not load files.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [connectionId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("File is too large. Maximum size is 25 MB.");
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const attachment = await uploadV2ConnectionAttachment(connectionId, {
        file,
        role: "attachment",
      });
      setAttachments((current) => [attachment, ...current]);
    } catch {
      setError("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemove(attachment: V2ConnectionAttachment) {
    const shouldRemove = window.confirm("Remove this file from the connector?");
    if (!shouldRemove) return;

    setRemovingId(attachment.id);
    setError(null);
    try {
      await deleteV2ConnectionAttachment(connectionId, attachment.id);
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id)
      );
    } catch {
      setError("Remove failed.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleDownload(attachment: V2ConnectionAttachment) {
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
      ) : attachments.length === 0 ? (
        <p className="v2InspectorEmpty">No files attached to this connector yet.</p>
      ) : (
        <div className="v2InspectorAttachmentList">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="v2InspectorAttachmentRow">
              <span className="v2InspectorAttachmentIcon" aria-hidden="true">
                <FileText size={16} strokeWidth={2.1} />
              </span>
              <div className="v2InspectorAttachmentText">
                <strong title={attachment.filename}>{attachment.filename}</strong>
                <span>{getAttachmentMeta(attachment)}</span>
                <em>{attachment.processingStatus}</em>
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
                  onClick={() => void handleRemove(attachment)}
                  disabled={removingId === attachment.id}
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
