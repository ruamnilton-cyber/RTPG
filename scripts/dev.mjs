import { spawn } from "node:child_process";
import path from "node:path";
import { resolveDatabaseUrl } from "./data-dir.mjs";

const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(process.cwd())
};

const tsxBin = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js");

const children = [
  spawn(process.execPath, [tsxBin, "server/src/index.ts"], { stdio: "inherit", shell: false, env }),
  spawn(process.execPath, [viteBin], { stdio: "inherit", shell: false, env })
];

let shuttingDown = false;

const stopAll = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
};

for (const child of children) {
  child.on("exit", (code) => {
    stopAll(code ?? 0);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
