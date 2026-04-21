import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { appEnv } from "../env";
import { decryptSecret, encryptSecret } from "../lib/crypto";

function getSettingsFilePath() {
  const settingsDir = path.join(appEnv.storageDir, "settings");
  fs.mkdirSync(settingsDir, { recursive: true });
  return path.join(settingsDir, "system-settings.json");
}

function readFileSettings(): Record<string, string> {
  const filePath = getSettingsFilePath();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeFileSettings(data: Record<string, string>) {
  const filePath = getSettingsFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  // Ensure the fallback file is never world-readable
  try { fs.chmodSync(filePath, 0o600); } catch { /* ignore on non-unix */ }
}

export async function getStoredSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) return fallback;
    try {
      return JSON.parse(setting.value) as T;
    } catch {
      return fallback;
    }
  } catch (err) {
    console.warn(`[settings] Prisma indisponÃ­vel, usando fallback em arquivo para "${key}":`, (err as Error).message);
    const fileSettings = readFileSettings();
    if (!fileSettings[key]) return fallback;
    try {
      return JSON.parse(fileSettings[key]) as T;
    } catch {
      return fallback;
    }
  }
}

export async function setStoredSetting<T>(key: string, value: T) {
  try {
    return await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) }
    });
  } catch (err) {
    console.warn(`[settings] Prisma indisponÃ­vel, salvando em arquivo para "${key}":`, (err as Error).message);
    const fileSettings = readFileSettings();
    fileSettings[key] = JSON.stringify(value);
    writeFileSettings(fileSettings);
    return { key, value: JSON.stringify(value) };
  }
}

function barScopedKey(barId: string, key: string) {
  return `bar:${barId}:${key}`;
}

export async function getBarStoredSetting<T>(barId: string, key: string, fallback: T): Promise<T> {
  return getStoredSetting(barScopedKey(barId, key), fallback);
}

export async function setBarStoredSetting<T>(barId: string, key: string, value: T) {
  return setStoredSetting(barScopedKey(barId, key), value);
}

// â”€â”€ Encrypted secret helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function setSecretSetting(key: string, value: string | null) {
  if (value === null) return setStoredSetting(key, null);
  return setStoredSetting(key, encryptSecret(value));
}

export async function getSecretSetting(key: string): Promise<string | null> {
  const raw = await getStoredSetting<string | null>(key, null);
  if (!raw) return null;
  try {
    return decryptSecret(raw);
  } catch {
    return null;
  }
}

export async function setBarSecretSetting(barId: string, key: string, value: string | null) {
  return setSecretSetting(barScopedKey(barId, key), value);
}

export async function getBarSecretSetting(barId: string, key: string): Promise<string | null> {
  return getSecretSetting(barScopedKey(barId, key));
}
