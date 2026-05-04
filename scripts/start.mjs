import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

// Carrega .env se existir
const dotenvPath = path.join(projectRoot, ".env");
if (existsSync(dotenvPath)) {
  for (const line of readFileSync(dotenvPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
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
