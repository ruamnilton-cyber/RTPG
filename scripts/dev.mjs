import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl } from "./data-dir.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

// Resolve node_modules: tenta no projeto, depois no pai (ex: Google Drive layout)
function findNodeModulesBin(relPath) {
  const candidates = [
    path.join(projectRoot, "node_modules", relPath),
    path.join(projectRoot, "..", "node_modules", relPath)
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`Não encontrado: node_modules/${relPath}\nVerifique se as dependências estão instaladas.`);
}

const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(projectRoot),
  JWT_SECRET: process.env.JWT_SECRET ?? "rtpg-dev-secret"
};

const concurrentlyBin = findNodeModulesBin("concurrently/dist/bin/concurrently.js");
const tsxBin = findNodeModulesBin("tsx/dist/cli.mjs");
const viteBin = findNodeModulesBin("vite/bin/vite.js");

const child = spawn(
  process.execPath,
  [
    concurrentlyBin,
    `${process.execPath} ${tsxBin} ${path.join(projectRoot, "server/src/index.ts")}`,
    `${process.execPath} ${viteBin} --host localhost`
  ],
  { stdio: "inherit", shell: false, env, cwd: projectRoot }
);

child.on("exit", (code) => process.exit(code ?? 0));
