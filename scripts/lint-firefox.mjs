import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const webExtBinary = join(
  rootDirectory,
  "node_modules",
  "web-ext",
  "bin",
  "web-ext.js",
);
const result = spawnSync(
  process.execPath,
  [
    webExtBinary,
    "lint",
    "--source-dir",
    join(rootDirectory, "dist", "firefox"),
    "--warnings-as-errors",
  ],
  {
    cwd: rootDirectory,
    env: { ...process.env, NO_UPDATE_NOTIFIER: "1" },
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  throw new Error("Firefox extension validation failed.");
}
