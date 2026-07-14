import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const distDirectory = join(rootDirectory, "dist");
const sourceManifest = JSON.parse(
  await readFile(join(rootDirectory, "manifest.json"), "utf8"),
);
const packageJson = JSON.parse(
  await readFile(join(rootDirectory, "package.json"), "utf8"),
);

if (sourceManifest.version !== packageJson.version) {
  throw new Error(
    `Version mismatch: manifest.json is ${sourceManifest.version}, package.json is ${packageJson.version}.`,
  );
}

const firefoxManifest = {
  ...sourceManifest,
  browser_specific_settings: {
    gecko: {
      id: "tryhackme-utils-extension@theforbiddenduck.github.io",
      strict_min_version: "142.0",
      data_collection_permissions: {
        required: ["authenticationInfo", "browsingActivity"],
      },
    },
  },
};

const targets = [
  { name: "chrome", manifest: sourceManifest },
  { name: "firefox", manifest: firefoxManifest },
];

await rm(distDirectory, { force: true, recursive: true });

for (const target of targets) {
  const targetDirectory = join(distDirectory, target.name);
  await mkdir(targetDirectory, { recursive: true });
  await cp(join(rootDirectory, "src"), join(targetDirectory, "src"), {
    recursive: true,
  });
  await cp(
    join(rootDirectory, "assets", "icons"),
    join(targetDirectory, "assets", "icons"),
    { recursive: true },
  );
  await cp(join(rootDirectory, "LICENSE"), join(targetDirectory, "LICENSE"));
  await writeFile(
    join(targetDirectory, "manifest.json"),
    `${JSON.stringify(target.manifest, null, 2)}\n`,
  );
}

console.log(`Built Chrome and Firefox extensions in ${distDirectory}`);
