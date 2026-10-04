import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const legalDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../content/legal",
);
const lockPath = path.join(legalDirectory, "legal-content.lock.json");
const expectedDocuments = {
  "terms-of-use.md": "Terms of Use",
  "privacy-policy.md": "Privacy Policy",
};
const repository = "petrnagy/shortlistOS-legal";

function fail(message) {
  throw new Error(`[legal-content] ${message}`);
}

const lock = JSON.parse(await readFile(lockPath, "utf8"));

if (lock.repository !== repository) {
  fail(`Unexpected repository in ${path.basename(lockPath)}.`);
}

if (!/^[0-9a-f]{40}$/.test(lock.commit ?? "")) {
  fail(`The pinned commit in ${path.basename(lockPath)} must be a full SHA.`);
}

const documents = await Promise.all(
  Object.entries(expectedDocuments).map(async ([filename, expectedTitle]) => {
    const expectedHash = lock.files?.[filename];

    if (!/^[0-9a-f]{64}$/.test(expectedHash ?? "")) {
      fail(
        `Missing or invalid SHA-256 for ${filename} in ${path.basename(lockPath)}.`,
      );
    }

    const url = `https://raw.githubusercontent.com/${repository}/${lock.commit}/${filename}`;
    let response;

    try {
      response = await fetch(url, {
        headers: { "User-Agent": "shortlistOS-build" },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      fail(
        `Could not fetch ${filename} from the pinned legal repository: ${error.message}`,
      );
    }

    if (!response.ok) {
      fail(`Fetching ${filename} failed with HTTP ${response.status}.`);
    }

    const markdown = await response.text();

    if (!markdown.trim() || Buffer.byteLength(markdown, "utf8") > 1_000_000) {
      fail(`${filename} is empty or exceeds the 1 MB size limit.`);
    }

    if (!new RegExp(`^#\\s+${expectedTitle}\\s*$`, "m").test(markdown)) {
      fail(`${filename} must contain a level-one heading "${expectedTitle}".`);
    }

    if (!/^\*\*Effective date:\s*.+?\*\*/im.test(markdown)) {
      fail(`${filename} must declare an effective date.`);
    }

    const actualHash = createHash("sha256")
      .update(markdown, "utf8")
      .digest("hex");

    if (actualHash !== expectedHash) {
      fail(
        `SHA-256 mismatch for ${filename}; update the lock only with the intended legal revision.`,
      );
    }

    return [filename, markdown];
  }),
);

await mkdir(legalDirectory, { recursive: true });

for (const [filename, markdown] of documents) {
  await writeFile(path.join(legalDirectory, filename), markdown, "utf8");
  console.info(`[legal-content] Verified ${filename} at ${lock.commit}.`);
}
