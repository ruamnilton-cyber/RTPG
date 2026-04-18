import fs from "node:fs";
import path from "node:path";

function timestamp() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function toFilePath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }
  const rawPath = databaseUrl.replace(/^file:/, "");
  const normalized = decodeURIComponent(rawPath).replace(/\//g, path.sep);
  return path.resolve(normalized);
}

function safeCopy(source: string, destination: string) {
  if (!fs.existsSync(source)) return;
  fs.copyFileSync(source, destination);
}

export function createDatabaseBackup(storageDir: string, databaseUrl: string, keep = 20) {
  const dbPath = toFilePath(databaseUrl);
  if (!dbPath || !fs.existsSync(dbPath)) {
    return;
  }

  const backupDir = path.join(storageDir, "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = timestamp();
  const baseName = `rtpg-${stamp}.sqlite`;
  const backupDbPath = path.join(backupDir, baseName);
  safeCopy(dbPath, backupDbPath);
  safeCopy(`${dbPath}-wal`, `${backupDbPath}-wal`);
  safeCopy(`${dbPath}-shm`, `${backupDbPath}-shm`);

  const backups = fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sqlite"))
    .map((entry) => ({
      name: entry.name,
      fullPath: path.join(backupDir, entry.name),
      mtime: fs.statSync(path.join(backupDir, entry.name)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of backups.slice(keep)) {
    try {
      fs.unlinkSync(old.fullPath);
      const wal = `${old.fullPath}-wal`;
      const shm = `${old.fullPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {
      // Ignora falhas de limpeza para nÃ£o interromper inicializaÃ§Ã£o do app.
    }
  }
}
