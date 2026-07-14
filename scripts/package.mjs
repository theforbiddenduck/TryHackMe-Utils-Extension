import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const artifactsDirectory = join(rootDirectory, "artifacts");
const packageJson = JSON.parse(
  await readFile(join(rootDirectory, "package.json"), "utf8"),
);
const webExtBinary = join(
  rootDirectory,
  "node_modules",
  "web-ext",
  "bin",
  "web-ext.js",
);

await rm(artifactsDirectory, { force: true, recursive: true });
await mkdir(artifactsDirectory, { recursive: true });

for (const browser of ["chrome", "firefox"]) {
  const filename = `tryhackme-utils-extension-${packageJson.version}-${browser}.zip`;
  const result = spawnSync(
    process.execPath,
    [
      webExtBinary,
      "build",
      "--source-dir",
      join(rootDirectory, "dist", browser),
      "--artifacts-dir",
      artifactsDirectory,
      "--filename",
      filename,
      "--overwrite-dest",
    ],
    {
      cwd: rootDirectory,
      env: { ...process.env, NO_UPDATE_NOTIFIER: "1" },
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error(`Could not package the ${browser} extension.`);
  }
}

const artifactNames = (await readdir(artifactsDirectory))
  .filter((name) => name.endsWith(".zip"))
  .sort();
const checksums = [];

for (const artifactName of artifactNames) {
  const contents = await readFile(join(artifactsDirectory, artifactName));
  const digest = createHash("sha256").update(contents).digest("hex");
  checksums.push(`${digest}  ${artifactName}`);
}

await writeFile(
  join(artifactsDirectory, "SHA256SUMS.txt"),
  `${checksums.join("\n")}\n`,
);

console.log(`Packaged release artifacts in ${artifactsDirectory}`);
