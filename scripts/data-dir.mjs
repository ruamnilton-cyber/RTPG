import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
  return target;
}

export function resolveRtpgBaseDir(customCwd = process.cwd()) {
  const envDir = process.env.RTPG_DATA_DIR;
  if (envDir) {
    return ensureDir(path.resolve(envDir));
  }

  const cwd = path.resolve(customCwd);
  const baseName = path.basename(cwd).toLowerCase();
  if (baseName === "rtpg") {
    return ensureDir(cwd);
  }

  const candidates = [
    path.join(cwd, "rtpg"),
    path.join(os.homedir(), "Google Drive", "rtpg"),
    path.join(os.homedir(), "Meu Drive", "rtpg"),
    path.join(os.homedir(), "My Drive", "rtpg"),
    path.join(os.homedir(), "OneDrive", "rtpg"),
    path.join(os.homedir(), "Documents", "rtpg")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return ensureDir(candidate);
    }
  }

  return ensureDir(path.join(cwd, "rtpg_local"));
}

export function resolveStorageDir(customCwd = process.cwd()) {
  return ensureDir(path.join(resolveRtpgBaseDir(customCwd), "storage"));
}

export function resolveDatabaseUrl(customCwd = process.cwd()) {
  const storageDir = resolveStorageDir(customCwd);
  const dbPath = path.join(storageDir, "rtpg.sqlite").replace(/\\/g, "/");
  return `file:${dbPath}`;
}
