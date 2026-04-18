import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { appEnv } from "../env";

function getSettingsFilePath() {
  const settingsDir = path.join(appEnv.storageDir, "settings");
  fs.mkdirSync(settingsDir, { recursive: true });
  return path.join(settingsDir, "system-settings.json");
}

function readFileSettings(): Record<string, string> {
  const filePath = getSettingsFilePath();
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeFileSettings(data: Record<string, string>) {
  fs.writeFileSync(getSettingsFilePath(), JSON.stringify(data, null, 2), "utf-8");
}

export async function getStoredSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) {
      return fallback;
    }

    try {
      return JSON.parse(setting.value) as T;
    } catch {
      return fallback;
    }
  } catch {
    const fileSettings = readFileSettings();
    if (!fileSettings[key]) {
      return fallback;
    }

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
  } catch {
    const fileSettings = readFileSettings();
    fileSettings[key] = JSON.stringify(value);
    writeFileSettings(fileSettings);
    return { key, value: JSON.stringify(value) };
  }
}
