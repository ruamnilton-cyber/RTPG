import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { comparePassword, hashPassword, signToken, verifyToken } from "../lib/auth";
import { formatTokenFromHeader } from "../lib/utils";
import { clearLoginRateLimit, loginRateLimit } from "../middleware/security";
import { requireAuth, requirePlatformAdmin } from "../middleware/auth";
import { logAction } from "../services/logging";
import { createSaasClient, getSaasClients } from "../services/platform";
import { confirmSaasCheckoutPayment, createSaasCheckout, getBillingConfig, saveBillingConfig, billingConfigPublicView, validateBillingWebhookSignature } from "../services/billing";

const router = Router();

const loginSchema = z.object({
  email: z.string().min(2, "Informe o login ou e-mail."),
  password: z.string().min(5, "A senha deve ter ao menos 5 caracteres.")
});

const registerSchema = z.object({
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(5, "A senha deve ter ao menos 5 caracteres."),
  name: z.string().min(2, "Informe o nome."),
  role: z.enum(["ADMIN", "GERENTE", "CAIXA", "GARCOM", "COZINHA", "FINANCEIRO", "OPERADOR"]).default("OPERADOR")
});

const selfSignupSchema = z.object({
  businessName: z.string().min(2, "Informe o nome do restaurante."),
  contactName: z.string().min(2, "Informe seu nome."),
  phone: z.string().min(8, "Informe um WhatsApp valido."),
  email: z.string().email("Informe um e-mail valido."),
  accessLogin: z.string().min(2, "Escolha um login para acessar o sistema."),
  password: z.string().min(5, "A senha deve ter ao menos 5 caracteres."),
  planName: z.string().default("Plano Profissional"),
  monthlyFee: z.number().min(0).default(149)
});

router.post("/login", loginRateLimit, async (req, res) => {
  const data = loginSchema.parse(req.body);
  const identifier = data.email.trim().toLowerCase();
  const candidates = identifier.includes("@")
    ? [identifier]
    : [identifier, `${identifier}@cliente.rtpg.local`, `${identifier}@rtpg.local`];

  const user = await prisma.user.findFirst({
    where: { email: { in: candidates } }
  });

  if (!user || !user.active) {
    return res.status(400).json({ message: "Login ou senha invalidos." });
  }

  const validPassword = await comparePassword(data.password, user.passwordHash);
  if (!validPassword) {
    return res.status(400).json({ message: "Login ou senha invalidos." });
  }

  clearLoginRateLimit(req);

  const token = signToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email
  });

  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

router.get("/bootstrap-status", async (_req, res) => {
  const count = await prisma.user.count();
  res.json({ needsBootstrap: count === 0 });
});

router.post("/self-signup", loginRateLimit, async (req, res) => {
  const data = selfSignupSchema.parse(req.body);
  const trialDays = Number(process.env.SAAS_TRIAL_DAYS ?? 3);
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(now.getDate() + trialDays);
  dueDate.setHours(23, 59, 59, 999);

  const client = await createSaasClient({
    businessName: data.businessName,
    contactName: data.contactName,
    accessLogin: data.accessLogin,
    temporaryPassword: data.password,
    phone: data.phone,
    email: data.email,
    planName: data.planName,
    monthlyFee: data.monthlyFee,
    billingDay: dueDate.getDate(),
    nextDueDate: dueDate.toISOString(),
    lastPaymentDate: "",
    status: "TRIAL",
    accessStatus: "LIBERADO",
    notes: `Auto-cadastro publico em trial de ${trialDays} dia(s). Forma de cobranca preparada para Pix, cartao e Play Store.`,
    payments: []
  });

  const user = await prisma.user.findUnique({ where: { id: client.linkedUserId } });
  if (!user) {
    throw new Error("Conta criada, mas nao consegui iniciar a sessao automaticamente.");
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email
  });

  clearLoginRateLimit(req);

  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    client: {
      id: client.id,
      businessName: client.businessName,
      accessLogin: client.accessLogin,
      trialEndsAt: client.nextDueDate,
      monthlyFee: client.monthlyFee,
      status: client.status
    }
  });
});

router.get("/billing-status", requireAuth, async (req, res) => {
  const clients = await getSaasClients();
  const client = clients.find((item) => item.linkedUserId === req.user!.userId);
  if (!client) {
    return res.json({ hasBilling: false });
  }
  const billingConfig = await getBillingConfig();

  const dueDate = new Date(client.nextDueDate);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysToDue = Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay);

  res.json({
    hasBilling: true,
    clientId: client.id,
    businessName: client.businessName,
    planName: client.planName,
    monthlyFee: client.monthlyFee,
    status: client.status,
    accessStatus: client.accessStatus,
    nextDueDate: client.nextDueDate,
    daysToDue,
    paymentMethods: [
      { id: "pix", label: "Pix", status: billingConfig.pixKey ? "ativo" : "pendente_configuracao" },
      { id: "credit_card", label: "Cartao de credito", status: billingConfig.creditCardCheckoutUrl ? "ativo" : "pendente_configuracao" },
      { id: "play_store", label: "Play Store", status: "futuro" }
    ]
  });
});

router.post("/billing-checkout", requireAuth, async (req, res) => {
  const data = z.object({
    method: z.enum(["pix", "credit_card", "play_store"])
  }).parse(req.body);
  const clients = await getSaasClients();
  const client = clients.find((item) => item.linkedUserId === req.user!.userId);
  if (!client) {
    return res.status(404).json({ message: "Assinatura nao encontrada para este usuario." });
  }

  const checkout = await createSaasCheckout({ clientId: client.id, method: data.method });
  res.json(checkout);
});

router.get("/billing-admin/config", requireAuth, requirePlatformAdmin, async (_req, res) => {
  const config = await getBillingConfig();
  res.json({
    ...billingConfigPublicView(config),
    creditCardCheckoutUrl: config.creditCardCheckoutUrl,
    webhookSecretConfigured: Boolean(config.webhookSecret),
    appBaseUrl: config.appBaseUrl,
    pixKeyMasked: config.pixKey ? `${config.pixKey.slice(0, 4)}...${config.pixKey.slice(-4)}` : ""
  });
});

router.put("/billing-admin/config", requireAuth, requirePlatformAdmin, async (req, res) => {
  const data = z.object({
    pixKey: z.string().optional(),
    pixRecipientName: z.string().optional(),
    pixCity: z.string().optional(),
    creditCardCheckoutUrl: z.string().optional(),
    webhookSecret: z.string().optional(),
    appBaseUrl: z.string().optional()
  }).parse(req.body);

  const next = await saveBillingConfig(data);
  res.json({
    ...billingConfigPublicView(next),
    creditCardCheckoutUrl: next.creditCardCheckoutUrl,
    webhookSecretConfigured: Boolean(next.webhookSecret),
    appBaseUrl: next.appBaseUrl,
    pixKeyMasked: next.pixKey ? `${next.pixKey.slice(0, 4)}...${next.pixKey.slice(-4)}` : ""
  });
});

router.post("/billing-webhook/confirm", async (req, res) => {
  const data = z.object({
    clientId: z.string().min(5),
    amount: z.number().positive(),
    paidAt: z.string().optional(),
    referenceMonth: z.string().optional(),
    notes: z.string().optional(),
    token: z.string().min(10)
  }).parse(req.body);

  const signature = req.headers["x-rtpg-signature"];
  const signatureValue = Array.isArray(signature) ? signature[0] : signature;
  const valid = await validateBillingWebhookSignature(signatureValue, data.token);
  if (!valid) {
    return res.status(401).json({ message: "Assinatura invalida do webhook." });
  }

  const client = await confirmSaasCheckoutPayment({
    clientId: data.clientId,
    amount: data.amount,
    paidAt: data.paidAt,
    referenceMonth: data.referenceMonth,
    notes: data.notes
  });

  if (!client) {
    return res.status(404).json({ message: "Cliente nao encontrado para confirmar pagamento." });
  }

  res.json({ ok: true, clientId: client.id, status: client.status, accessStatus: client.accessStatus });
});

router.post("/register", async (req, res) => {
  let actorUserId: string | undefined;
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    const bearer = formatTokenFromHeader(req.headers.authorization);
    if (!bearer) {
      return res.status(403).json({
        message: "Cadastro publico desativado. Peca a um administrador para criar sua conta em Usuarios."
      });
    }
    try {
      const authUser = verifyToken(bearer);
      if (authUser.role !== "ADMIN" || authUser.email !== "admin@rtpg.local") {
        return res.status(403).json({ message: "Apenas administradores podem criar usuarios." });
      }
      actorUserId = authUser.userId;
    } catch {
      return res.status(401).json({ message: "Sessao invalida ou expirada." });
    }
  }

  const data = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    return res.status(400).json({ message: "Ja existe um usuario com este e-mail." });
  }

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: userCount === 0 ? "ADMIN" : data.role,
      passwordHash: await hashPassword(data.password)
    }
  });

  await logAction({
    userId: actorUserId,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    description: `Usuario ${user.email} criado`
  });

  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, active: true }
  });
  res.json(user);
});

router.get("/users", requireAuth, requirePlatformAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }
  });
  res.json(users);
});

router.post("/forgot-password", async (req, res) => {
  const data = z.object({ email: z.string().email() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  return res.json({
    ok: true,
    message: user
      ? "Solicitacao registrada. Em uma proxima etapa, este fluxo podera enviar token por e-mail."
      : "Se existir uma conta com este e-mail, a solicitacao foi registrada."
  });
});

router.post("/reset-password", requireAuth, async (req, res) => {
  const data = z.object({
    currentPassword: z.string().min(5),
    newPassword: z.string().min(5)
  }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    throw new Error("Usuario nao encontrado.");
  }

  const validPassword = await comparePassword(data.currentPassword, user.passwordHash);
  if (!validPassword) {
    throw new Error("Senha atual incorreta.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(data.newPassword) }
  });

  res.json({ ok: true });
});

router.put("/users/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(["ADMIN", "GERENTE", "CAIXA", "GARCOM", "COZINHA", "FINANCEIRO", "OPERADOR"]),
    active: z.boolean()
  }).parse(req.body);

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  await logAction({
    userId: req.user!.userId,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    description: `Usuario ${user.email} atualizado`
  });
  res.json(user);
});

router.delete("/users/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  await logAction({
    userId: req.user!.userId,
    action: "DELETE",
    entityType: "User",
    entityId: req.params.id,
    description: "Usuario removido"
  });
  res.status(204).send();
});

export default router;
