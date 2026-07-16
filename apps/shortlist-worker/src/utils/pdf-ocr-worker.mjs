import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
} from "@napi-rs/canvas";

const require = createRequire(import.meta.url);
const { createWorker } = require("tesseract.js");
const { loadPdfJs } = require(resolveOfficeparserFile("utils/moduleLoader.js"));

const MAX_OCR_PAGES = 10;
const OCR_RENDER_SCALE = 2;
const [, , inputPath] = process.argv;

if (!inputPath) {
  throw new Error("PDF OCR worker requires an input path.");
}

const browserGlobals = /** @type {Record<string, unknown>} */ (globalThis);
browserGlobals.DOMMatrix ??= DOMMatrix;
browserGlobals.ImageData ??= ImageData;
browserGlobals.Path2D ??= Path2D;

const warnings = [];
const buffer = await readFile(inputPath);
const pdfjs = await loadPdfJs();

if (process.env.SHORTLIST_OCR_PDF_WORKER_SRC) {
  pdfjs.GlobalWorkerOptions.workerSrc =
    process.env.SHORTLIST_OCR_PDF_WORKER_SRC;
}

const pdfDocument = await pdfjs.getDocument({
  data: new Uint8Array(buffer),
  isEvalSupported: false,
  verbosity: 0,
}).promise;
const pageCount = Math.min(pdfDocument.numPages, MAX_OCR_PAGES);
const worker = await createWorker("eng", 1, {
  corePath: process.env.SHORTLIST_OCR_CORE_PATH || undefined,
  workerPath: process.env.SHORTLIST_OCR_WORKER_PATH || undefined,
});
const pageTexts = [];

try {
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const canvasContext = canvas.getContext("2d");

    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext,
      viewport,
    }).promise;

    const image = canvas.toBuffer("image/png");
    const {
      data: { text },
    } = await worker.recognize(image);
    const trimmedText = text.trim();

    if (trimmedText) {
      pageTexts.push(trimmedText);
    }
  }
} finally {
  await worker.terminate();
}

if (pdfDocument.numPages > MAX_OCR_PAGES) {
  warnings.push({
    code: "PDF_OCR_PAGE_LIMIT",
    message: `OCR processed ${MAX_OCR_PAGES} of ${pdfDocument.numPages} pages.`,
  });
}

const text = pageTexts.join("\n\n").trim();

process.stdout.write(
  JSON.stringify({
    pageCount: pdfDocument.numPages,
    processedPages: pageCount,
    rawTextLength: text.length,
    text,
    warnings,
  }),
);

/** @param {string} relativePath */
function resolveOfficeparserFile(relativePath) {
  const packagePath = require.resolve("officeparser");

  return join(dirname(packagePath), relativePath);
}
