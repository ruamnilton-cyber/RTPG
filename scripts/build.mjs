import { spawn } from "node:child_process";
import path from "node:path";
import { resolveDatabaseUrl } from "./data-dir.mjs";

const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(process.cwd()),
  JWT_SECRET: process.env.JWT_SECRET ?? "rtpg-dev-secret"
};

// Apenas build do frontend (Vite). O backend roda via tsx sem compilação.
const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js");
const viteChild = spawn(process.execPath, [viteBin, "build"], {
  stdio: "inherit",
  shell: false,
  env
});

viteChild.on("exit", (code) => process.exit(code ?? 0));
