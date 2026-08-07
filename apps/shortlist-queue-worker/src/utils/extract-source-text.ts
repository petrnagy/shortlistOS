import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { createLogger } from "@kan/logger";
import { getShortlistFileExtension } from "@kan/shared/constants";

const logger = createLogger("shortlist-queue-worker:extract-source-text");
const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const OCR_TIMEOUT_MS = 120_000;
const OCR_CACHE_DIR = join(tmpdir(), "shortlistos", "ocr-cache");

const OFFICEPARSER_FILE_TYPES = [
  "csv",
  "docx",
  "epub",
  "html",
  "md",
  "odp",
  "ods",
  "odt",
  "pdf",
  "pptx",
  "rtf",
  "xlsx",
] as const;

type OfficeparserFileType = (typeof OFFICEPARSER_FILE_TYPES)[number];

interface ExtractSourceTextInput {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

interface OfficeParserAst {
  to: (
    format: "text",
    config?: Record<string, unknown>,
  ) => Promise<{ value: string | Uint8Array; messages?: unknown[] }>;
}

export async function extractSourceText(
  input: ExtractSourceTextInput,
): Promise<string> {
  if (isTextContentType(input.contentType)) {
    return input.buffer.toString("utf8");
  }

  const fileType = getOfficeparserFileType(input.filename);

  if (!fileType) {
    throw new Error(`Unsupported source document type for ${input.filename}`);
  }

  const { OfficeParser } = await import("officeparser");
  const ast = (await OfficeParser.parseOffice(input.buffer, {
    fileType,
    ignoreComments: true,
    ignoreHeadersAndFooters: true,
    ignoreInternalLinks: true,
    ignoreNotes: true,
    ignoreSlideMasters: true,
    newlineDelimiter: "\n",
    ocr: false,
  })) as OfficeParserAst;
  const { value } = await ast.to("text");
  const text = typeof value === "string" ? value : Buffer.from(value).toString();

  if (!text.trim()) {
    if (fileType === "pdf") {
      const ocrText = await extractPdfTextWithOcrFallback(input.buffer, {
        filename: input.filename,
      });

      if (ocrText.trim()) {
        return ocrText;
      }
    }

    throw new Error(getEmptyExtractionError(input.filename, fileType));
  }

  return text;
}

function isTextContentType(contentType: string): boolean {
  return (
    contentType.startsWith("text/") ||
    contentType === "message/rfc822" ||
    contentType === "application/json"
  );
}

function getOfficeparserFileType(filename: string): OfficeparserFileType | null {
  const extension = getShortlistFileExtension(filename);

  return extension && isOfficeparserFileType(extension) ? extension : null;
}

function isOfficeparserFileType(value: string): value is OfficeparserFileType {
  return OFFICEPARSER_FILE_TYPES.includes(value as OfficeparserFileType);
}

function getEmptyExtractionError(
  filename: string,
  fileType: OfficeparserFileType,
): string {
  if (fileType === "pdf") {
    return [
      `No extractable PDF text layer was found in ${filename}.`,
      "The PDF may contain outlined/vector text or image-backed page content;",
      "upload the original document or enable a visual text extraction path.",
    ].join(" ");
  }

  return `No text could be extracted from ${filename}`;
}

async function extractPdfTextWithOcrFallback(
  buffer: Buffer,
  {
    filename,
  }: {
    filename: string;
  },
): Promise<string> {
  const startedAt = Date.now();
  const inputPath = join(tmpdir(), `shortlist-ocr-${randomUUID()}.pdf`);
  const cacheKey = createOcrCacheKey(buffer);
  const cachedResult = await readCachedOcrResult(cacheKey);

  if (cachedResult?.text.trim()) {
    logger.info(
      {
        cacheKey,
        filename,
        pageCount: cachedResult.pageCount,
        processedPages: cachedResult.processedPages,
        textLength: cachedResult.text.trim().length,
      },
      "PDF OCR fallback cache hit",
    );

    return cachedResult.text.trim();
  }

  logger.info({ filename }, "PDF text layer was empty; trying OCR fallback");

  try {
    await mkdir(dirname(inputPath), { recursive: true });
    await writeFile(inputPath, buffer);

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [resolveOcrWorkerPath(), inputPath],
      {
        env: {
          ...process.env,
          SHORTLIST_OCR_CORE_PATH: resolvePackagePath(
            "tesseract.js-core/tesseract-core.wasm.js",
          ),
          SHORTLIST_OCR_PDF_WORKER_SRC: resolvePackageUrl(
            "pdfjs-dist/legacy/build/pdf.worker.mjs",
          ),
          SHORTLIST_OCR_WORKER_PATH: resolvePackagePath(
            "tesseract.js/src/worker-script/node/index.js",
          ),
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: OCR_TIMEOUT_MS,
      },
    );
    const result = parseOcrWorkerResult(stdout);
    const trimmedText = result.text.trim();

    for (const issue of result.warnings) {
      logger.warn(
        {
          filename,
          issue,
        },
        "PDF OCR fallback warning",
      );
    }

    if (stderr.trim()) {
      logger.warn(
        {
          filename,
          stderr: stderr.trim(),
        },
        "PDF OCR fallback wrote to stderr",
      );
    }

    logger.info(
      {
        cacheKey,
        durationMs: Date.now() - startedAt,
        filename,
        pageCount: result.pageCount,
        processedPages: result.processedPages,
        rawTextLength: result.rawTextLength,
        textLength: trimmedText.length,
      },
      trimmedText
        ? "PDF OCR fallback extracted text"
        : "PDF OCR fallback completed without text",
    );

    if (trimmedText) {
      await writeCachedOcrResult(cacheKey, {
        createdAt: new Date().toISOString(),
        filename,
        pageCount: result.pageCount,
        processedPages: result.processedPages,
        rawTextLength: result.rawTextLength,
        text: trimmedText,
      });
    }

    return trimmedText;
  } catch (error) {
    logger.error(
      {
        durationMs: Date.now() - startedAt,
        error: formatUnknownError(error),
        errorDetails: serializeUnknownError(error),
        filename,
      },
      "PDF OCR fallback failed",
    );

    return "";
  } finally {
    await rm(inputPath, { force: true });
  }
}

function resolvePackagePath(packagePath: string): string {
  try {
    return require.resolve(packagePath);
  } catch {
    return "";
  }
}

function resolvePackageUrl(packagePath: string): string {
  const resolvedPath = resolvePackagePath(packagePath);

  return resolvedPath ? pathToFileURL(resolvedPath).href : "";
}

function resolveOcrWorkerPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "pdf-ocr-worker.mjs");
}

function parseOcrWorkerResult(stdout: string): {
  pageCount: number;
  processedPages: number;
  rawTextLength: number;
  text: string;
  warnings: Record<string, unknown>[];
} {
  const result = JSON.parse(stdout.trim()) as {
    pageCount?: unknown;
    processedPages?: unknown;
    rawTextLength?: unknown;
    text?: unknown;
    warnings?: unknown;
  };

  return {
    pageCount: typeof result.pageCount === "number" ? result.pageCount : 0,
    processedPages:
      typeof result.processedPages === "number" ? result.processedPages : 0,
    rawTextLength:
      typeof result.rawTextLength === "number" ? result.rawTextLength : 0,
    text: typeof result.text === "string" ? result.text : "",
    warnings: Array.isArray(result.warnings)
      ? result.warnings.filter(isRecord)
      : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createOcrCacheKey(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function getOcrCachePath(cacheKey: string): string {
  return join(OCR_CACHE_DIR, `${cacheKey}.json`);
}

async function readCachedOcrResult(
  cacheKey: string,
): Promise<OcrCacheEntry | null> {
  try {
    const cacheFile = await readFile(getOcrCachePath(cacheKey), "utf8");
    const parsed = JSON.parse(cacheFile) as unknown;

    if (!isOcrCacheEntry(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedOcrResult(
  cacheKey: string,
  entry: OcrCacheEntry,
): Promise<void> {
  await mkdir(OCR_CACHE_DIR, { recursive: true });
  await writeFile(getOcrCachePath(cacheKey), JSON.stringify(entry), "utf8");
}

interface OcrCacheEntry {
  createdAt: string;
  filename: string;
  pageCount: number;
  processedPages: number;
  rawTextLength: number;
  text: string;
}

function isOcrCacheEntry(value: unknown): value is OcrCacheEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.createdAt === "string" &&
    typeof value.filename === "string" &&
    typeof value.pageCount === "number" &&
    typeof value.processedPages === "number" &&
    typeof value.rawTextLength === "number" &&
    typeof value.text === "string"
  );
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;

  return String(error);
}

function serializeUnknownError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  return Object.fromEntries(
    Object.getOwnPropertyNames(error).map((propertyName) => [
      propertyName,
      (error as unknown as Record<string, unknown>)[propertyName],
    ]),
  );
}
