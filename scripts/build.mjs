import { spawn } from "node:child_process";
import path from "node:path";
import { resolveDatabaseUrl } from "./data-dir.mjs";

const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(process.cwd()),
  JWT_SECRET: process.env.JWT_SECRET ?? "rtpg-dev-secret"
};

const tscBin = path.resolve("node_modules", "typescript", "bin", "tsc");
const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js");
const child = spawn(process.execPath, [tscBin, "--noEmit"], {
  stdio: "inherit",
  shell: false,
  env
});

child.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const viteChild = spawn(process.execPath, [viteBin, "build"], {
    stdio: "inherit",
    shell: false,
    env
  });

  viteChild.on("exit", (viteCode) => process.exit(viteCode ?? 0));
});
