import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl } from "./data-dir.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

function findNodeModulesBin(relPath) {
  const candidates = [
    path.join(projectRoot, "node_modules", relPath),
    path.join(projectRoot, "..", "node_modules", relPath)
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`Não encontrado: node_modules/${relPath}`);
}

const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(projectRoot),
  JWT_SECRET: process.env.JWT_SECRET ?? "rtpg-dev-secret",
  NODE_ENV: "production"
};

const tsxBin = findNodeModulesBin("tsx/dist/cli.mjs");
const serverEntry = path.join(projectRoot, "server/src/index.ts");

const child = spawn(process.execPath, [tsxBin, serverEntry], {
  stdio: "inherit",
  shell: false,
  env,
  cwd: projectRoot
});

child.on("exit", (code) => process.exit(code ?? 0));
