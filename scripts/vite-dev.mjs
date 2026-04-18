import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const viteBin = findNodeModulesBin("vite/bin/vite.js");

const child = spawn(
  process.execPath,
  [viteBin, "--host", "localhost", "--port", "5173"],
  {
    stdio: "inherit",
    shell: false,
    cwd: projectRoot
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
