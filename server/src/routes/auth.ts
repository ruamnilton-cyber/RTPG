import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { comparePassword, hashPassword, signToken, verifyToken } from "../lib/auth";
import { formatTokenFromHeader } from "../lib/utils";
import { requireAuth, requirePlatformAdmin, requireRole } from "../middleware/auth";
import { getEffectiveBarIds, requireBar } from "../middleware/bar";
import { clearLoginRateLimit, loginRateLimit } from "../middleware/security";
import { logAction } from "../services/logging";
import { createSaasClientFromTrial } from "../services/platform";
import { getStoredSetting, setStoredSetting } from "../services/system-settings";
import { getPlanById, SUBSCRIPTION_TRIAL_DAYS } from "../../../shared/subscription-plans";
import { emailService, type WelcomeEmailInput } from "../services/email";

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
  password: z.string().min(5, "A senha deve ter ao menos 5 caracteres."),
  planId: z.string().optional()
});

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `restaurante-${Date.now()}`;
}

async function createUniqueBarSlug(businessName: string) {
  const base = slugify(businessName);
  let slug = base;
  let suffix = 1;

  while (await prisma.bar.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }

  return slug;
}

async function seedTrialBar(barId: string) {
  const categories = ["Petiscos", "Pratos", "Bebidas", "Sobremesas"];
  await Promise.all(
    categories.map((name, index) =>
      prisma.productCategory.upsert({
        where: { barId_name: { barId, name } },
        update: {},
        create: { barId, name, sortOrder: index }
      })
    )
  );

  const expenseCategories = [
    { name: "Equipe", groupType: "OPERACIONAL" },
    { name: "Agua", groupType: "OPERACIONAL" },
    { name: "Luz", groupType: "OPERACIONAL" },
    { name: "Aluguel", groupType: "OPERACIONAL" },
    { name: "Internet", groupType: "OPERACIONAL" },
    { name: "Impostos", groupType: "ADMINISTRATIVA" },
    { name: "Outras despesas", groupType: "OUTRAS" }
  ];
  await Promise.all(
    expenseCategories.map((item) =>
      prisma.expenseCategory.upsert({
        where: { barId_name: { barId, name: item.name } },
        update: {},
        create: { barId, name: item.name, groupType: item.groupType }
      })
    )
  );

  const tables = Array.from({ length: 12 }, (_, index) => index + 1);
  await Promise.all(
    tables.map((number) =>
      prisma.restaurantTable.upsert({
        where: { barId_number: { barId, number } },
        update: {},
        create: {
          barId,
          number,
          name: `Mesa ${number}`,
          qrCodeToken: crypto.randomUUID()
        }
      })
    )
  );
}

async function sendWelcomeEmailWithoutBlockingSignup(input: WelcomeEmailInput) {
  try {
    if (!emailService.isConfigured()) {
      console.warn("[email] SES SMTP nao configurado; email de boas-vindas nao enviado.");
      return;
    }
    await emailService.sendWelcomeEmail(input);
  } catch (err) {
    console.error("[email] Falha ao enviar email de boas-vindas.", err);
  }
}

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
    return res.status(400).json({ message: "Usuario nao encontrado ou inativo." });
  }

  const validPassword = await comparePassword(data.password, user.passwordHash);
  if (!validPassword) {
    return res.status(400).json({ message: "Senha incorreta." });
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
  const email = data.email.trim().toLowerCase();
  const trialDays = Number(process.env.SAAS_TRIAL_DAYS ?? SUBSCRIPTION_TRIAL_DAYS);
  const selectedPlan = getPlanById(data.planId) ?? getPlanById("professional");

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ message: "Ja existe um usuario com este e-mail. Use a aba de login para entrar." });
  }

  const slug = await createUniqueBarSlug(data.businessName);
  const passwordHash = await hashPassword(data.password);

  const result = await prisma.$transaction(async (tx) => {
    const bar = await tx.bar.create({
      data: {
        name: data.businessName.trim(),
        slug,
        phone: data.phone.trim(),
        active: true
      }
    });

    const user = await tx.user.create({
      data: {
        name: data.contactName.trim(),
        email,
        role: "ADMIN",
        passwordHash
      }
    });

    await tx.userBar.create({
      data: { userId: user.id, barId: bar.id }
    });

    return { bar, user };
  });

  await seedTrialBar(result.bar.id);

  if (selectedPlan) {
    await createSaasClientFromTrial({
      businessName: result.bar.name,
      contactName: result.user.name,
      phone: data.phone.trim(),
      email: result.user.email,
      planName: selectedPlan.name,
      monthlyFee: selectedPlan.monthlyPrice,
      linkedBarId: result.bar.id,
      linkedUserId: result.user.id,
      linkedUserEmail: result.user.email,
      trialDays
    });
  }

  await logAction({
    userId: result.user.id,
    action: "TRIAL_SIGNUP",
    entityType: "Bar",
    entityId: result.bar.id,
    description: `Teste gratis criado para ${result.bar.name}. Plano: ${selectedPlan?.name ?? "Profissional"}. Responsavel: ${result.user.name}. WhatsApp: ${data.phone}.`
  });

  await sendWelcomeEmailWithoutBlockingSignup({
    name: result.user.name,
    email: result.user.email,
    login: result.user.email,
    businessName: result.bar.name
  });

  const token = signToken({
    userId: result.user.id,
    role: result.user.role,
    name: result.user.name,
    email: result.user.email
  });

  clearLoginRateLimit(req);

  res.status(201).json({
    token,
    user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
    bar: { id: result.bar.id, name: result.bar.name, slug: result.bar.slug },
    trial: { days: trialDays, plan: selectedPlan }
  });
});

router.post("/register", async (req, res) => {
  let actorUserId: string | undefined;
  let actorBarId: string | undefined;
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
      if (authUser.role !== "ADMIN") {
        return res.status(403).json({ message: "Apenas administradores podem criar usuarios." });
      }
      actorUserId = authUser.userId;
      const allowedBars = await getEffectiveBarIds(authUser.userId, authUser.role, authUser.email);
      const headerBar = typeof req.headers["x-bar-id"] === "string" ? req.headers["x-bar-id"].trim() : "";
      actorBarId = headerBar && allowedBars.includes(headerBar) ? headerBar : allowedBars[0];
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

  if (actorBarId) {
    await prisma.userBar.upsert({
      where: { userId_barId: { userId: user.id, barId: actorBarId } },
      update: {},
      create: { userId: user.id, barId: actorBarId }
    });
  }

  await logAction({
    userId: actorUserId,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    description: `Usuario ${user.email} criado`
  });

  await sendWelcomeEmailWithoutBlockingSignup({
    name: user.name,
    email: user.email,
    login: user.email,
    password: data.password
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

router.get("/users", requireAuth, requireRole("ADMIN"), requireBar, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { bars: { some: { barId: req.barId! } } },
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

router.put("/users/:id", requireAuth, requireRole("ADMIN"), requireBar, async (req, res) => {
  const data = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(["ADMIN", "GERENTE", "CAIXA", "GARCOM", "COZINHA", "FINANCEIRO", "OPERADOR"]),
    active: z.boolean()
  }).parse(req.body);

  const existing = await prisma.user.findFirst({
    where: { id: req.params.id, bars: { some: { barId: req.barId! } } }
  });
  if (!existing) {
    return res.status(404).json({ message: "Usuario nao encontrado neste restaurante." });
  }

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

router.delete("/users/:id", requireAuth, requireRole("ADMIN"), requireBar, async (req, res) => {
  const existing = await prisma.user.findFirst({
    where: { id: req.params.id, bars: { some: { barId: req.barId! } } },
    include: { bars: true }
  });
  if (!existing) {
    return res.status(404).json({ message: "Usuario nao encontrado neste restaurante." });
  }

  if (existing.id === req.user!.userId) {
    return res.status(400).json({ message: "Voce nao pode remover o proprio usuario." });
  }

  if (existing.bars.length > 1) {
    await prisma.userBar.delete({ where: { userId_barId: { userId: existing.id, barId: req.barId! } } });
  } else {
    await prisma.user.delete({ where: { id: req.params.id } });
  }
  await logAction({
    userId: req.user!.userId,
    action: "DELETE",
    entityType: "User",
    entityId: req.params.id,
    description: "Usuario removido"
  });
  res.status(204).send();
});

// Captura de leads públicos (sem autenticação)
router.post("/lead", async (req, res) => {
  const data = z.object({
    nome:        z.string().min(2),
    restaurante: z.string().min(2),
    telefone:    z.string().min(8),
    email:       z.string().email().optional().or(z.literal(""))
  }).parse(req.body);

  type Lead = typeof data & { createdAt: string };
  const existing = await getStoredSetting<Lead[]>("saas_leads", []);
  const leads = Array.isArray(existing) ? existing : [];
  leads.push({ ...data, createdAt: new Date().toISOString() });
  await setStoredSetting("saas_leads", leads as unknown as string);
  res.status(201).json({ ok: true });
});

// Listar leads (admin)
router.get("/leads", requireAuth, requirePlatformAdmin, async (_req, res) => {
  const leads = await getStoredSetting("saas_leads", []);
  res.json(Array.isArray(leads) ? leads : []);
});

export default router;
