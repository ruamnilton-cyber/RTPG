import { spawn } from "node:child_process";
import path from "node:path";
import { resolveDatabaseUrl } from "./data-dir.mjs";

const args = process.argv.slice(2);
const prismaBin = path.resolve("node_modules", "prisma", "build", "index.js");
const env = {
  ...process.env,
  DATABASE_URL: resolveDatabaseUrl(process.cwd())
};

const child = spawn(process.execPath, [prismaBin, ...args], {
  stdio: "inherit",
  env
});

child.on("exit", (code) => process.exit(code ?? 0));
