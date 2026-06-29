"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, FileText, Paperclip, X } from "lucide-react";
import type { V2CardAttachment } from "@yadraw/shared";
import {
  deleteV2CardAttachment,
  getV2FileDownloadUrl,
  listV2CardAttachments,
  uploadV2CardAttachment,
} from "./api";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type V2CardAttachmentsSectionProps = {
  cardId: string;
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
}: V2CardAttachmentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<V2CardAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError(null);

    listV2CardAttachments(cardId)
      .then((items) => {
        if (!isActive) return;
        setAttachments(items);
      })
      .catch(() => {
        if (!isActive) return;
        setAttachments([]);
        setError("Не удалось загрузить список файлов");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [cardId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("Файл больше 25 MB");
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const attachment = await uploadV2CardAttachment(cardId, {
        file,
        role: "attachment",
      });
      setAttachments((current) => [attachment, ...current]);
    } catch {
      setError("Не удалось прикрепить файл");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDetach(attachment: V2CardAttachment) {
    const shouldDetach = window.confirm("Убрать файл из карточки?");
    if (!shouldDetach) return;

    setDetachingId(attachment.id);
    setError(null);
    try {
      await deleteV2CardAttachment(cardId, attachment.id);
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id)
      );
    } catch {
      setError("Не удалось убрать файл");
    } finally {
      setDetachingId(null);
    }
  }

  return (
    <section className="v2InspectorSection">
      <div className="v2InspectorSectionHeader">
        <h3>Файлы</h3>
        <button
          type="button"
          className="v2InspectorAttachButton"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Paperclip size={14} strokeWidth={2.2} />
          <span>{isUploading ? "Загрузка" : "Прикрепить"}</span>
        </button>
        <input
          ref={fileInputRef}
          className="v2InspectorFileInput"
          type="file"
          onChange={(event) => void handleFileChange(event)}
        />
      </div>

      {isLoading ? (
        <p className="v2InspectorEmpty">Загрузка файлов...</p>
      ) : attachments.length === 0 ? (
        <p className="v2InspectorEmpty">Пока нет файлов</p>
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
                <a
                  href={getV2FileDownloadUrl(attachment.fileId)}
                  download={attachment.filename}
                  aria-label={`Скачать ${attachment.filename}`}
                >
                  <Download size={14} strokeWidth={2.2} />
                </a>
                <button
                  type="button"
                  aria-label={`Убрать ${attachment.filename}`}
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
