import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl, resolveRtpgBaseDir, resolveStorageDir } from "../../scripts/data-dir.mjs";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "../../");

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolveDatabaseUrl(projectRoot);
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "rtpg-dev-secret";
  console.warn("[Aviso] JWT_SECRET não definido — usando chave padrão insegura. Defina JWT_SECRET no ambiente antes de ir para produção.");
}

export const appEnv = {
  projectRoot,
  rtpgBaseDir: resolveRtpgBaseDir(projectRoot),
  storageDir: resolveStorageDir(projectRoot),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  port: Number(process.env.PORT ?? 3333),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? null,
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? null
};
