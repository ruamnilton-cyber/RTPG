import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl, resolveRtpgBaseDir, resolveStorageDir } from "../../scripts/data-dir.mjs";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../../");
const storageDir = resolveStorageDir(projectRoot);

function loadDotEnvFile(filePath: string) {
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

loadDotEnvFile(path.join(projectRoot, ".env"));
loadDotEnvFile(path.join(projectRoot, ".env.local"));

function resolveJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  const secretsDir = path.join(storageDir, "secrets");
  const secretPath = path.join(secretsDir, "jwt-secret.txt");
  fs.mkdirSync(secretsDir, { recursive: true });

  if (fs.existsSync(secretPath)) {
    const stored = fs.readFileSync(secretPath, "utf8").trim();
    if (stored.length >= 32) {
      return stored;
    }
  }

  const generated = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(secretPath, generated, { encoding: "utf8", flag: "w" });
  return generated;
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolveDatabaseUrl(projectRoot);
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = resolveJwtSecret();
}

export const appEnv = {
  projectRoot,
  rtpgBaseDir: resolveRtpgBaseDir(projectRoot),
  storageDir,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  port: Number(process.env.PORT ?? 3333)
};
