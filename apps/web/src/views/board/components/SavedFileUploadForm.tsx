import { t } from "@lingui/core/macro";
import { env } from "next-runtime-env";
import { useRef, useState } from "react";
import {
  HiCheckCircle,
  HiOutlineDocumentArrowUp,
  HiXMark,
} from "react-icons/hi2";

import { Alert } from "~/components/Alert";
import Button from "~/components/Button";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["txt", "doc", "docx", "odt", "pdf"]);
const ACCEPTED_FILE_TYPES = ".txt,.docx,.odt,.pdf";

export function SavedFileUploadForm({
  boardPublicId,
}: {
  boardPublicId: string;
}) {
  const { closeModal } = useModal();
  const { showPopup } = usePopup();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const validateFile = (nextFile: File): string | null => {
    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      return t`The file must be 10 MB or smaller.`;
    }

    const extension = getFileExtension(nextFile.name);
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      return t`Please upload a TXT, Word, OpenDocument, or PDF file.`;
    }

    return null;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const validationError = validateFile(selectedFile);
    setFile(validationError ? null : selectedFile);
    setError(validationError);
    event.target.value = "";
  };

  const handleUpload = async () => {
    if (!file) {
      setError(t`Please select a file to upload.`);
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const baseUrl = env("NEXT_PUBLIC_BASE_URL") ?? "";
      const response = await fetch(
        `${baseUrl}/api/upload/shortlist-file?boardPublicId=${encodeURIComponent(boardPublicId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "x-original-filename": file.name,
          },
          body: file,
        },
      );

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      closeModal();
      showPopup({
        header: t`File uploaded`,
        message: t`We'll process it shortly and add the opportunity to Saved when it's ready.`,
        icon: "success",
      });
    } catch {
      setError(t`We couldn't upload the file. Please try again.`);
      setUploading(false);
    }
  };

  return (
    <div className="px-5 pt-5">
      <div className="flex w-full items-center justify-between pb-5">
        <h2 className="text-sm font-bold text-neutral-900 dark:text-dark-1000">
          {t`Upload a job opportunity`}
        </h2>
        <button
          type="button"
          className="rounded p-1 hover:bg-light-200 focus:outline-none dark:hover:bg-dark-300"
          onClick={() => closeModal()}
          disabled={uploading}
        >
          <HiXMark size={18} className="text-light-900 dark:text-dark-900" />
        </button>
      </div>

      <div className="space-y-4 pb-5">
        {error && (
          <Alert title={t`Upload failed`} variant="danger">
            {error}
          </Alert>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-light-400 px-4 py-8 text-center hover:bg-light-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-400 dark:hover:bg-dark-200"
        >
          <span className="flex flex-col items-center gap-2 text-sm text-light-900 dark:text-dark-900">
            {file ? (
              <HiCheckCircle className="h-8 w-8 text-light-950 dark:text-dark-950" />
            ) : (
              <HiOutlineDocumentArrowUp className="h-8 w-8 text-light-950 dark:text-dark-950" />
            )}
            <span className="font-medium text-light-1000 dark:text-dark-1000">
              {file ? file.name : t`Choose a file`}
            </span>
            <span className="text-xs">
              {t`TXT, Word, OpenDocument, or PDF. Maximum 10 MB.`}
            </span>
          </span>
        </button>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => closeModal()}
            disabled={uploading}
          >
            {t`Cancel`}
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
            isLoading={uploading}
          >
            {t`Upload`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function getFileExtension(filename: string): string | null {
  const lastDotIndex = filename.lastIndexOf(".");

  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return null;
  }

  return filename.slice(lastDotIndex + 1).toLowerCase();
}
