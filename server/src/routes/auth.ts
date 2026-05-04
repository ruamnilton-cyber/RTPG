import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { comparePassword, hashPassword, signToken, verifyToken } from "../lib/auth";
import { formatTokenFromHeader } from "../lib/utils";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAction } from "../services/logging";
import { getStoredSetting, setStoredSetting } from "../services/system-settings";
import { sendLeadWelcomeEmail } from "../services/email";

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

router.post("/login", async (req, res) => {
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
      if (authUser.role !== "ADMIN") {
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

router.get("/users", requireAuth, requireRole("ADMIN"), async (_req, res) => {
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

router.put("/users/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
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

router.delete("/users/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
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

  if (data.email) {
    sendLeadWelcomeEmail({ to: data.email, nome: data.nome, restaurante: data.restaurante }).catch(() => {});
  }

  res.status(201).json({ ok: true });
});

// Listar leads (admin)
router.get("/leads", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  const leads = await getStoredSetting("saas_leads", []);
  res.json(Array.isArray(leads) ? leads : []);
});

export default router;
