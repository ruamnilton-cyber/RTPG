import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const localPython = path.resolve(process.env.LOCALAPPDATA ?? "", "Python", "bin", "python.exe");
const command = fs.existsSync(localPython) ? localPython : "python";

const child = spawn(command, ["scripts/bootstrap_db.py"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code) => process.exit(code ?? 0));
