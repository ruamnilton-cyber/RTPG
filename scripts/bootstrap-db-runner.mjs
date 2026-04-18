import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile(path.resolve(".env"));
loadDotEnvFile(path.resolve(".env.local"));

const localPython = path.resolve(process.env.LOCALAPPDATA ?? "", "Python", "bin", "python.exe");
const command = process.platform === "win32"
  ? fs.existsSync(localPython) ? localPython : "python"
  : "python3";

const child = spawn(command, ["scripts/bootstrap_db.py"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32"
});

child.on("exit", (code) => process.exit(code ?? 0));
