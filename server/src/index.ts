import "./env";
import "express-async-errors";
import path from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import barsRoutes from "./routes/bars";
import catalogRoutes from "./routes/catalog";
import inventoryRoutes from "./routes/inventory";
import tablesRoutes from "./routes/tables";
import reportsRoutes from "./routes/reports";
import publicRoutes from "./routes/public";
import settingsRoutes from "./routes/settings";
import systemRoutes from "./routes/system";
import organizationRoutes from "./routes/organization";
import financeRoutes from "./routes/finance";
import aiRoutes from "./routes/ai";
import cashierRoutes from "./routes/cashier";
import customersRoutes from "./routes/customers";
import saasClientsRoutes from "./routes/saas-clients";
import ordersRoutes from "./routes/orders";
import { errorHandler } from "./middleware/error-handler";
import { appEnv } from "./env";
import { bootstrapWhatsAppConnections } from "./services/whatsapp";
import { applySecurityHeaders, publicStorageGuard } from "./middleware/security";

const app = express();

app.disable("x-powered-by");
app.use(applySecurityHeaders);
app.use(cors({ allowedHeaders: ["Content-Type", "Authorization", "X-Bar-Id"] }));
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storageDir: appEnv.storageDir, baseDir: appEnv.rtpgBaseDir });
});

app.use("/api/auth", authRoutes);
app.use("/api/bars", barsRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/operations", tablesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/cashier", cashierRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/saas-clients", saasClientsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/public", publicRoutes);
app.use("/storage-files", publicStorageGuard, express.static(appEnv.storageDir));

const distClientDir = path.join(appEnv.projectRoot, "dist", "client");
app.use(express.static(distClientDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distClientDir, "index.html"));
});

app.use(errorHandler);

app.listen(appEnv.port, () => {
  console.log(`RTPG Gestao disponivel em http://localhost:${appEnv.port}`);
  console.log(`Dados persistidos em: ${appEnv.storageDir}`);
});

bootstrapWhatsAppConnections().catch((error) => {
  console.error("Falha ao restaurar conexoes do WhatsApp:", error);
});
