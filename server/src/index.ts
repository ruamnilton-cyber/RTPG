import "./env";
import "express-async-errors";
import path from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import catalogRoutes from "./routes/catalog";
import inventoryRoutes from "./routes/inventory";
import tablesRoutes from "./routes/tables";
import reportsRoutes from "./routes/reports";
import publicRoutes from "./routes/public";
import settingsRoutes from "./routes/settings";
import organizationRoutes from "./routes/organization";
import financeRoutes from "./routes/finance";
import aiRoutes from "./routes/ai";
import whatsappRoutes from "./routes/whatsapp";
import cashierRoutes from "./routes/cashier";
import paymentsRoutes from "./routes/payments";
import customersRoutes from "./routes/customers";
import saasClientsRoutes from "./routes/saas-clients";
import emailConfigRoutes from "./routes/email-config";
import { errorHandler } from "./middleware/error-handler";
import { appEnv } from "./env";
import { startTelegramBot } from "./services/telegram-bot";

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;

app.use(cors({
  origin: allowedOrigins
    ? (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error("CORS not allowed"));
      }
    : true,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storageDir: appEnv.storageDir, baseDir: appEnv.rtpgBaseDir });
});

app.use("/api/auth", authRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/operations", tablesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/cashier", cashierRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/saas-clients", saasClientsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/email", emailConfigRoutes);
app.use("/public", publicRoutes);
app.use("/storage-files", express.static(appEnv.storageDir));

const distClientDir = path.join(appEnv.projectRoot, "dist", "client");
app.use(express.static(distClientDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distClientDir, "index.html"));
});

app.use(errorHandler);

app.listen(appEnv.port, () => {
  console.log(`RTPG Gestão disponível em http://localhost:${appEnv.port}`);
  console.log(`Dados persistidos em: ${appEnv.storageDir}`);
  startTelegramBot();
});
