import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version || "")) {
  throw new Error("Usage: npm run version:set -- <major.minor.patch>");
}

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const files = {
  manifest: join(rootDirectory, "manifest.json"),
  package: join(rootDirectory, "package.json"),
  lock: join(rootDirectory, "package-lock.json"),
};
const manifest = JSON.parse(await readFile(files.manifest, "utf8"));
const packageJson = JSON.parse(await readFile(files.package, "utf8"));
const packageLock = JSON.parse(await readFile(files.lock, "utf8"));

manifest.version = version;
packageJson.version = version;
packageLock.version = version;
packageLock.packages[""].version = version;

await Promise.all([
  writeFile(files.manifest, `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(files.package, `${JSON.stringify(packageJson, null, 2)}\n`),
  writeFile(files.lock, `${JSON.stringify(packageLock, null, 2)}\n`),
]);

console.log(`Updated manifest and package versions to ${version}.`);
