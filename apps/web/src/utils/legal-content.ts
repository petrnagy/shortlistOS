import fs from "node:fs";
import path from "node:path";

export type LegalDocument = {
  title: string;
  effectiveDate: string;
  markdown: string;
};

type LegalDocumentName = "privacy-policy" | "terms-of-use";

const legalContentDirectory = path.join(process.cwd(), "content", "legal");

function readMarkdownFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

function parseLegalMarkdown(markdown: string, fallbackTitle: string): LegalDocument {
  let content = markdown.trim();
  let title = fallbackTitle;
  let effectiveDate = "not configured";

  const titleMatch = content.match(/^#\s+(.+)\n+/);

  if (titleMatch?.[1]) {
    title = titleMatch[1].trim();
    content = content.slice(titleMatch[0].length).trim();
  }

  const effectiveDateMatch = content.match(
    /^\*\*Effective date:\s*(.+?)\*\*\s*/i,
  );

  if (effectiveDateMatch?.[1]) {
    effectiveDate = effectiveDateMatch[1].trim();
    content = content.slice(effectiveDateMatch[0].length).trim();
  }

  return {
    title,
    effectiveDate,
    markdown: content,
  };
}

export function loadLegalDocument(
  documentName: LegalDocumentName,
  fallbackTitle: string,
) {
  const localPath = path.join(legalContentDirectory, `${documentName}.md`);
  const examplePath = path.join(
    legalContentDirectory,
    `${documentName}.example.md`,
  );

  const markdown =
    readMarkdownFile(localPath) ??
    readMarkdownFile(examplePath) ??
    `# ${fallbackTitle}\n\n**Effective date: not configured**\n\nThis legal page has not been configured yet.`;

  return parseLegalMarkdown(markdown, fallbackTitle);
}
