import { spawn } from "node:child_process";
import path from "node:path";
import { resolveDatabaseUrl } from "./data-dir.mjs";

const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(process.cwd()),
  NODE_ENV: "production"
};

const tsxBin = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
const child = spawn(process.execPath, [tsxBin, "server/src/index.ts"], {
  stdio: "inherit",
  shell: false,
  env
});

child.on("exit", (code) => process.exit(code ?? 0));
