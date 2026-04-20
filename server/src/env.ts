import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl, resolveRtpgBaseDir, resolveStorageDir } from "../../scripts/data-dir.mjs";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../../");

function loadDotEnv(filePath: string) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(path.join(projectRoot, ".env"));

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolveDatabaseUrl(projectRoot);
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "rtpg-dev-secret";
}

export const appEnv = {
  projectRoot,
  rtpgBaseDir: resolveRtpgBaseDir(projectRoot),
  storageDir: resolveStorageDir(projectRoot),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  port: Number(process.env.PORT ?? 3333),
  appBaseUrl: process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3333}`,
  ses: {
    host: process.env.SES_SMTP_HOST ?? "",
    port: Number(process.env.SES_SMTP_PORT ?? 587),
    user: process.env.SES_SMTP_USER ?? "",
    pass: process.env.SES_SMTP_PASS ?? "",
    fromEmail: process.env.SES_FROM_EMAIL ?? "",
    fromName: process.env.SES_FROM_NAME ?? "RTPG App"
  },
  platformAsaas: {
    apiKey: process.env.PLATFORM_ASAAS_API_KEY ?? "",
    sandbox: process.env.PLATFORM_ASAAS_SANDBOX !== "false",
    webhookToken: process.env.PLATFORM_ASAAS_WEBHOOK_TOKEN ?? ""
  }
};
