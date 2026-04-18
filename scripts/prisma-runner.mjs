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

const args = process.argv.slice(2);
const prismaBin = findNodeModulesBin("prisma/build/index.js");
const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(projectRoot)
};

const child = spawn(process.execPath, [prismaBin, ...args], {
  stdio: "inherit",
  env,
  cwd: projectRoot
});

child.on("exit", (code) => process.exit(code ?? 0));
