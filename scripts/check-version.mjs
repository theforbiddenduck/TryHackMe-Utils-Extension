import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  await readFile(join(rootDirectory, "manifest.json"), "utf8"),
);
const packageJson = JSON.parse(
  await readFile(join(rootDirectory, "package.json"), "utf8"),
);

if (manifest.version !== packageJson.version) {
  throw new Error(
    `Version mismatch: manifest.json is ${manifest.version}, package.json is ${packageJson.version}.`,
  );
}

if (process.env.GITHUB_REF_TYPE === "tag") {
  const expectedTag = `v${packageJson.version}`;
  if (process.env.GITHUB_REF_NAME !== expectedTag) {
    throw new Error(
      `Release tag ${process.env.GITHUB_REF_NAME} does not match ${expectedTag}.`,
    );
  }
}

console.log(`Version ${packageJson.version} is consistent.`);
