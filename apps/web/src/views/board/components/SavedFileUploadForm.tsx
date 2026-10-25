import { t } from "@lingui/core/macro";
import { env } from "next-runtime-env";
import { useRef, useState } from "react";
import { HiCheckCircle, HiOutlineDocumentArrowUp } from "react-icons/hi2";

import { Alert } from "~/components/Alert";
import Button from "~/components/Button";
import Input from "~/components/Input";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { fetchJobOpportunity } from "~/utils/fetch-job-opportunity";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["txt", "docx", "odt", "pdf"]);
const ACCEPTED_FILE_TYPES = ".txt,.docx,.odt,.pdf";

export function SavedFileUploadForm({
  boardPublicId,
  listPublicId,
  method = "upload",
  onBusyChange,
}: {
  boardPublicId: string;
  listPublicId: string;
  method?: "upload" | "link" | "text";
  onBusyChange?: (busy: boolean) => void;
}) {
  const { closeModal } = useModal();
  const { showPopup } = usePopup();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const utils = api.useUtils();
  const recordFailure = api.activityLog.recordImportFailure.useMutation({
    onSuccess: () => {
      void utils.activityLog.list.invalidate();
    },
  });
  const reportFailure = (
    reason: "PAGE_FETCH_FAILED" | "SUBMISSION_FAILED",
    sourceUrl?: string,
  ) => {
    recordFailure.mutate({
      boardPublicId,
      sourceKind: method,
      reason,
      sourceUrl,
      sourceTitle: (method === "link"
        ? (sourceUrl ?? "Linked opportunity")
        : method === "text"
          ? "Pasted opportunity text"
          : (file?.name ?? "Uploaded opportunity")
      ).slice(0, 512),
    });
  };

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
    if (method === "upload" && !file) {
      setError(t`Please select a file to upload.`);
      return;
    }

    const validationError =
      method === "upload" && file ? validateFile(file) : null;
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    onBusyChange?.(true);
    setError(null);

    try {
      let sourceFile = file;
      let sourceUrl: string | undefined;
      if (method === "text") {
        if (!text.trim()) {
          setError(t`Please paste the job opportunity text.`);
          return;
        }
        sourceFile = new File([text.trim()], "job-opportunity.txt", {
          type: "text/plain;charset=utf-8",
        });
      }
      if (method === "link") {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url.trim());
          if (
            !["http:", "https:"].includes(parsedUrl.protocol) ||
            parsedUrl.username ||
            parsedUrl.password
          )
            throw new Error("Invalid URL");
        } catch {
          setError(t`Please enter a valid HTTP or HTTPS URL.`);
          return;
        }
        sourceUrl = parsedUrl.href;
        try {
          sourceFile = await fetchJobOpportunity(sourceUrl);
        } catch {
          setError(
            t`We couldn't read this page. The website may block access. Paste the opportunity into the Text tab or use the Web Clipper instead.`,
          );
          reportFailure("PAGE_FETCH_FAILED", sourceUrl);
          return;
        }
      }
      if (!sourceFile) return;
      if (sourceFile.size > MAX_FILE_SIZE_BYTES) {
        setError(t`The file must be 10 MB or smaller.`);
        return;
      }
      const params = new URLSearchParams({
        boardPublicId,
        listPublicId,
        intakeMethod: method,
      });
      if (sourceUrl) params.set("sourceUrl", sourceUrl);
      const baseUrl = env("NEXT_PUBLIC_BASE_URL") ?? "";
      const response = await fetch(
        `${baseUrl}/api/upload/shortlist-file?${params.toString()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": sourceFile.type || "application/octet-stream",
            "x-original-filename": sourceFile.name,
          },
          body: sourceFile,
        },
      );

      if (!response.ok) {
        if (response.status === 403) {
          setError(
            t`An active Powerpack and permission to add opportunities are required.`,
          );
          return;
        }
        throw new Error("Upload failed");
      }

      closeModal();
      showPopup({
        header: t`Opportunity submitted`,
        message: t`Processing may take a minute or two. We'll add the opportunity to your selected column when it's ready.`,
        icon: "success",
      });
    } catch {
      setError(t`We couldn't submit the opportunity. Please try again.`);
      reportFailure(
        "SUBMISSION_FAILED",
        method === "link" ? url.trim() : undefined,
      );
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div className="px-5 pt-5">
      <div className="flex w-full items-center justify-between pb-5">
        <h2 className="text-sm font-bold text-neutral-900 dark:text-dark-1000">
          {method === "upload"
            ? t`Upload a job opportunity`
            : method === "link"
              ? t`Add a job opportunity from a link`
              : t`Add a job opportunity from text`}
        </h2>
      </div>

      <div className="space-y-4 pb-5">
        {error && (
          <Alert title={t`Unable to add opportunity`} variant="danger">
            {error}
          </Alert>
        )}

        <p className="text-sm text-light-900 dark:text-dark-900">{t`Processing may take a minute or two. You can keep using shortlistOS while we add the opportunity to this column.`}</p>

        {method === "link" && (
          <>
            <label
              htmlFor="opportunity-import-url"
              className="block text-sm font-medium text-light-1000 dark:text-dark-1000"
            >{t`Job posting URL`}</label>
            <Input
              id="opportunity-import-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={uploading}
              placeholder="https://example.com/jobs/123"
            />
            <Alert>
              <p>{t`Use a publicly available job posting that does not require login.`}</p>
              <p className="mt-2">{t`If importing a link fails, the website may block automated access. Use our Web Clipper instead: it can save pages you can access, including pages requiring login or a subscription.`}</p>
            </Alert>
          </>
        )}

        {method === "text" && (
          <>
            <label
              htmlFor="opportunity-import-text"
              className="block text-sm font-medium text-light-1000 dark:text-dark-1000"
            >{t`Job opportunity text`}</label>
            <textarea
              id="opportunity-import-text"
              rows={10}
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={uploading}
              placeholder={t`Paste the copied job opportunity here...`}
              className="focus:outline-brand-500 w-full rounded-md border border-light-600 bg-transparent px-3 py-2 text-sm text-light-1000 dark:border-dark-600 dark:text-dark-1000"
            />
          </>
        )}

        {method === "upload" && (
          <>
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
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            onClick={handleUpload}
            disabled={
              uploading ||
              (method === "upload"
                ? !file
                : method === "link"
                  ? !url.trim()
                  : !text.trim())
            }
            isLoading={uploading}
          >
            {method === "upload" ? t`Upload` : t`Submit`}
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
