import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function tryEnsureDir(target) {
  try {
    fs.mkdirSync(target, { recursive: true });
    return target;
  } catch {
    return null;
  }
}

function normalizePath(target) {
  return path.resolve(target).replace(/\\/g, "/").toLowerCase();
}

function samePath(a, b) {
  return normalizePath(a) === normalizePath(b);
}

function getFileStatSafe(target) {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

function copyIfExists(source, destination) {
  if (!fs.existsSync(source) || fs.existsSync(destination)) {
    return;
  }
  try {
    fs.copyFileSync(source, destination);
  } catch {
    // Ignora erro de cÃ³pia para manter fallback resiliente.
  }
}

function getLegacyBaseCandidates(customCwd) {
  const cwd = path.resolve(customCwd);
  const candidates = new Set();

  if (path.basename(cwd).toLowerCase() === "rtpg") {
    candidates.add(cwd);
  }

  [
    path.join(cwd, "rtpg"),
    path.join(cwd, "rtpg_local"),
    cwd,
    path.join(os.homedir(), "Google Drive", "rtpg"),
    path.join(os.homedir(), "Meu Drive", "rtpg"),
    path.join(os.homedir(), "My Drive", "rtpg"),
    path.join(os.homedir(), "OneDrive", "rtpg"),
    path.join(os.homedir(), "Documents", "rtpg")
  ].forEach((candidate) => candidates.add(candidate));

  return Array.from(candidates);
}

function migrateLegacyDatabaseIfNeeded(preferredBaseDir, customCwd) {
  const preferredStorage = tryEnsureDir(path.join(preferredBaseDir, "storage"));
  if (!preferredStorage) {
    return;
  }

  const preferredDb = path.join(preferredStorage, "rtpg.sqlite");
  if (fs.existsSync(preferredDb)) {
    return;
  }

  for (const legacyBase of getLegacyBaseCandidates(customCwd)) {
    if (samePath(legacyBase, preferredBaseDir)) {
      continue;
    }

    const legacyDb = path.join(legacyBase, "storage", "rtpg.sqlite");
    const dbStat = getFileStatSafe(legacyDb);
    if (!dbStat || dbStat.size <= 0) {
      continue;
    }

    copyIfExists(legacyDb, preferredDb);
    if (!fs.existsSync(preferredDb)) {
      continue;
    }

    copyIfExists(`${legacyDb}-wal`, `${preferredDb}-wal`);
    copyIfExists(`${legacyDb}-shm`, `${preferredDb}-shm`);
    break;
  }
}

export function resolveRtpgBaseDir(customCwd = process.cwd()) {
  const envDir = process.env.RTPG_DATA_DIR;
  if (envDir) {
    const envResolved = tryEnsureDir(path.resolve(envDir));
    if (envResolved) {
      migrateLegacyDatabaseIfNeeded(envResolved, customCwd);
      return envResolved;
    }
  }

  const cwd = path.resolve(customCwd);
  const preferredCandidates = [
    path.join(cwd, "rtpg_local"),
    ...(path.basename(cwd).toLowerCase() === "rtpg" ? [cwd] : []),
    path.join(os.homedir(), "Documents", "rtpg"),
    ...(process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, "RTPG")] : []),
    path.join(os.homedir(), ".rtpg")
  ];

  for (const candidate of preferredCandidates) {
    const resolved = tryEnsureDir(candidate);
    if (resolved) {
      migrateLegacyDatabaseIfNeeded(resolved, customCwd);
      return resolved;
    }
  }

  for (const candidate of getLegacyBaseCandidates(customCwd)) {
    if (fs.existsSync(candidate)) {
      const resolved = tryEnsureDir(candidate);
      if (resolved) {
        return resolved;
      }
    }
  }

  return tryEnsureDir(path.join(path.resolve(customCwd), "rtpg_local")) ?? path.resolve(customCwd);
}

export function resolveStorageDir(customCwd = process.cwd()) {
  return tryEnsureDir(path.join(resolveRtpgBaseDir(customCwd), "storage")) ?? path.resolve(customCwd);
}

export function resolveDatabaseUrl(customCwd = process.cwd()) {
  const storageDir = resolveStorageDir(customCwd);
  const dbPath = path.join(storageDir, "rtpg.sqlite").replace(/\\/g, "/");
  return `file:${dbPath}`;
}
