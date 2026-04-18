import { spawn } from "node:child_process";
import path from "node:path";
import { resolveDatabaseUrl } from "./data-dir.mjs";

const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(process.cwd())
};

const concurrentlyBin = path.resolve("node_modules", "concurrently", "dist", "bin", "concurrently.js");
const tsxBin = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js");
const child = spawn(
  process.execPath,
  [concurrentlyBin, `${process.execPath} ${tsxBin} server/src/index.ts`, `${process.execPath} ${viteBin}`],
  { stdio: "inherit", shell: false, env }
);

child.on("exit", (code) => process.exit(code ?? 0));
