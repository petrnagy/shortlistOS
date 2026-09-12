import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

if (
  typeof packageJson.version !== "string" ||
  !versionPattern.test(packageJson.version)
) {
  throw new Error(
    'The root package.json must contain a semantic "version" in major.minor.patch format.',
  );
}

console.log(`Application version: ${packageJson.version}`);
