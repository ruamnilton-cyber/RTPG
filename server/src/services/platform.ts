import { randomUUID } from "node:crypto";
import { AiPanelSetting, aiPanelSchema, CashierSession, cashierSessionSchema, CustomerRecord, customerRecordSchema, FinanceTitle, financeTitleSchema, OrganizationSetting, organizationSchema, SaasClientRecord, saasClientSchema, SaasPaymentRecord, saasPaymentSchema } from "../contracts/platform";
import { hashPassword } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { parseDateRange } from "../lib/utils";
import { getBarStoredSetting, getStoredSetting, setBarStoredSetting, setStoredSetting } from "./system-settings";

const DEFAULT_ORGANIZATION: OrganizationSetting = {
  companyName: "RTPG Gestao",
  tradeName: "RTPG Gestao",
  cnpj: "",
  operationModel: "MONOUNIDADE",
  primaryFocus: "HIBRIDO",
  branches: [
    {
      id: "branch-main",
      name: "Unidade Principal",
      code: "MATRIZ",
      city: "",
      state: "",
      active: true,
      timezone: "America/Sao_Paulo",
      serviceFee: 0,
      deliveryFee: 0,
      channels: ["SALAO", "BALCAO", "QR"]
    }
  ],
  channelsEnabled: ["SALAO", "BALCAO", "QR"],
  whatsappAutomationEnabled: false
};

const DEFAULT_AI_PANEL: AiPanelSetting = {
  assistantName: "RTPG AI",
  channels: ["WHATSAPP", "QR"],
  autoReplyEnabled: true,
  audioTranscriptionEnabled: true,
  handoffThreshold: 65,
  upsellEnabled: true,
  estimatedAutomationRate: 42,
  handoffReasons: [
    "Cliente pediu desconto fora da politica",
    "Problema com pagamento",
    "Reclamacao sensivel",
    "Endereco fora da area de entrega"
  ]
};

const DEFAULT_TITLES: FinanceTitle[] = [
  {
    id: "title-pagar-1",
    kind: "PAGAR",
    description: "Aluguel da unidade",
    category: "Aluguel",
    branchId: "branch-main",
    costCenter: "ADMINISTRATIVO",
    amount: 1800,
    dueDate: new Date().toISOString(),
    status: "PENDENTE",
    counterparty: "Locador",
    notes: "Titulo inicial de demonstracao",
    createdAt: new Date().toISOString()
  },
  {
    id: "title-receber-1",
    kind: "RECEBER",
    description: "Evento corporativo em aberto",
    category: "Eventos",
    branchId: "branch-main",
    costCenter: "COMERCIAL",
    amount: 950,
    dueDate: new Date().toISOString(),
    status: "PENDENTE",
    counterparty: "Cliente corporativo",
    notes: "Recebimento manual de demonstracao",
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_CASHIER_SESSIONS: CashierSession[] = [];
const DEFAULT_CUSTOMERS: CustomerRecord[] = [];
const DEFAULT_SAAS_CLIENTS: SaasClientRecord[] = [];

function slugifyAccess(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

async function createUniqueBarSlug(baseValue: string) {
  const base = slugifyAccess(baseValue) || `bar${Date.now().toString().slice(-5)}`;
  let candidate = base;
  let counter = 1;
  while (await prisma.bar.findUnique({ where: { slug: candidate } })) {
    counter += 1;
    candidate = `${base}${counter}`;
  }
  return candidate;
}

async function createUniqueUserEmail(loginValue: string) {
  const base = slugifyAccess(loginValue) || `cliente${Date.now().toString().slice(-5)}`;
  let candidate = `${base}@cliente.rtpg.local`;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { email: candidate } })) {
    counter += 1;
    candidate = `${base}${counter}@cliente.rtpg.local`;
  }
  return candidate;
}

export async function getOrganizationSetting(barId?: string) {
  const stored = barId
    ? await getBarStoredSetting(barId, "platform-organization", DEFAULT_ORGANIZATION)
    : await getStoredSetting("platform-organization", DEFAULT_ORGANIZATION);
  return organizationSchema.parse(stored);
}

export async function saveOrganizationSetting(input: Partial<OrganizationSetting>, barId?: string) {
  const current = await getOrganizationSetting(barId);
  const next = organizationSchema.parse({ ...current, ...input });
  if (barId) {
    await setBarStoredSetting(barId, "platform-organization", next);
  } else {
    await setStoredSetting("platform-organization", next);
  }
  return next;
}

export async function getFinanceTitles(barId?: string) {
  const stored = barId
    ? await getBarStoredSetting(barId, "finance-titles", DEFAULT_TITLES)
    : await getStoredSetting("finance-titles", DEFAULT_TITLES);
  return stored.map((item) => financeTitleSchema.parse(item));
}

export async function saveFinanceTitles(titles: FinanceTitle[], barId?: string) {
  if (barId) {
    await setBarStoredSetting(barId, "finance-titles", titles);
  } else {
    await setStoredSetting("finance-titles", titles);
  }
  return titles;
}

export async function createFinanceTitle(input: Omit<FinanceTitle, "id" | "createdAt">, barId?: string) {
  const current = await getFinanceTitles(barId);
  const nextItem = financeTitleSchema.parse({
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString()
  });
  const next = [nextItem, ...current];
  await saveFinanceTitles(next, barId);
  return nextItem;
}

export async function updateFinanceTitle(id: string, input: Partial<FinanceTitle>, barId?: string) {
  const current = await getFinanceTitles(barId);
  const next = current.map((item) => (item.id === id ? financeTitleSchema.parse({ ...item, ...input, id: item.id, createdAt: item.createdAt }) : item));
  await saveFinanceTitles(next, barId);
  return next.find((item) => item.id === id) ?? null;
}

export async function getAiPanelSetting(barId?: string) {
  const stored = barId
    ? await getBarStoredSetting(barId, "ai-panel-setting", DEFAULT_AI_PANEL)
    : await getStoredSetting("ai-panel-setting", DEFAULT_AI_PANEL);
  return aiPanelSchema.parse(stored);
}

export async function saveAiPanelSetting(input: Partial<AiPanelSetting>, barId?: string) {
  const current = await getAiPanelSetting(barId);
  const next = aiPanelSchema.parse({ ...current, ...input });
  if (barId) {
    await setBarStoredSetting(barId, "ai-panel-setting", next);
  } else {
    await setStoredSetting("ai-panel-setting", next);
  }
  return next;
}

export async function getFinanceOverview(period?: string, start?: string, end?: string, barId?: string) {
  const range = parseDateRange(period, start, end);
  const titles = await getFinanceTitles(barId);
  const saleWhere = { soldAt: { gte: range.start, lte: range.end }, ...(barId ? { barId } : {}) };
  const expenseWhere = { expenseDate: { gte: range.start, lte: range.end }, ...(barId ? { barId } : {}) };
  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({ where: saleWhere }),
    prisma.expense.findMany({ where: expenseWhere, include: { category: true } })
  ]);

  const revenue = sales.reduce((sum, item) => sum + Number(item.finalAmount), 0);
  const cost = sales.reduce((sum, item) => sum + Number(item.costAmount), 0);
  const grossProfit = revenue - cost;
  const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const payableOpen = titles.filter((item) => item.kind === "PAGAR" && item.status !== "PAGO").reduce((sum, item) => sum + item.amount, 0);
  const receivableOpen = titles.filter((item) => item.kind === "RECEBER" && item.status !== "PAGO").reduce((sum, item) => sum + item.amount, 0);
  const cashProjection = revenue + receivableOpen - expenseTotal - payableOpen;

  return {
    cards: [
      { label: "Receita no periodo", value: revenue },
      { label: "CMV estimado", value: cost },
      { label: "Despesas no periodo", value: expenseTotal },
      { label: "Fluxo projetado", value: cashProjection }
    ],
    statement: {
      revenue,
      cost,
      grossProfit,
      expenseTotal,
      payableOpen,
      receivableOpen,
      cashProjection
    },
    payables: titles.filter((item) => item.kind === "PAGAR"),
    receivables: titles.filter((item) => item.kind === "RECEBER"),
    expensesByCategory: expenses.reduce<Record<string, number>>((acc, item) => {
      acc[item.category.name] = (acc[item.category.name] ?? 0) + Number(item.amount);
      return acc;
    }, {})
  };
}

export async function getCashierSessions(barId: string) {
  const stored = await getBarStoredSetting(barId, "cashier-sessions", DEFAULT_CASHIER_SESSIONS);
  return stored.map((item) => cashierSessionSchema.parse(item));
}

export async function saveCashierSessions(barId: string, sessions: CashierSession[]) {
  await setBarStoredSetting(barId, "cashier-sessions", sessions);
  return sessions;
}

export async function openCashierSession(barId: string, input: { userId: string; userName: string; branchId?: string; openingAmount: number }) {
  const sessions = await getCashierSessions(barId);
  const openSession = sessions.find((item) => item.status === "ABERTO" && item.userId === input.userId);
  if (openSession) {
    return openSession;
  }

  const next = cashierSessionSchema.parse({
    id: randomUUID(),
    userId: input.userId,
    userName: input.userName,
    branchId: input.branchId ?? "branch-main",
    status: "ABERTO",
    openingAmount: input.openingAmount,
    closingAmount: 0,
    expectedAmount: input.openingAmount,
    divergenceAmount: 0,
    openedAt: new Date().toISOString(),
    justification: "",
    movements: []
  });

  await saveCashierSessions(barId, [next, ...sessions]);
  return next;
}

export async function addCashierMovement(barId: string, sessionId: string, input: { type: "SANGRIA" | "REFORCO" | "AJUSTE"; amount: number; reason: string }) {
  const sessions = await getCashierSessions(barId);
  const next = sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const movements = [
      {
        id: randomUUID(),
        type: input.type,
        amount: input.amount,
        reason: input.reason,
        createdAt: new Date().toISOString()
      },
      ...session.movements
    ];
    const expectedAmount = movements.reduce((sum, movement) => {
      if (movement.type === "REFORCO") return sum + movement.amount;
      if (movement.type === "SANGRIA") return sum - movement.amount;
      return sum;
    }, session.openingAmount);

    return cashierSessionSchema.parse({
      ...session,
      movements,
      expectedAmount
    });
  });

  await saveCashierSessions(barId, next);
  return next.find((item) => item.id === sessionId) ?? null;
}

export async function closeCashierSession(barId: string, sessionId: string, input: { closingAmount: number; justification?: string }) {
  const sessions = await getCashierSessions(barId);
  const next = sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const divergenceAmount = input.closingAmount - session.expectedAmount;
    return cashierSessionSchema.parse({
      ...session,
      status: "FECHADO",
      closingAmount: input.closingAmount,
      divergenceAmount,
      closedAt: new Date().toISOString(),
      justification: input.justification ?? session.justification
    });
  });
  await saveCashierSessions(barId, next);
  return next.find((item) => item.id === sessionId) ?? null;
}

export async function getCustomers(barId: string, search?: string) {
  const stored = await getBarStoredSetting(barId, "crm-customers", DEFAULT_CUSTOMERS);
  const customers = stored.map((item) => customerRecordSchema.parse(item));
  if (!search) {
    return customers;
  }

  const normalized = search.toLowerCase();
  return customers.filter((item) =>
    item.name.toLowerCase().includes(normalized) ||
    item.phone.toLowerCase().includes(normalized) ||
    item.email.toLowerCase().includes(normalized) ||
    item.instagram.toLowerCase().includes(normalized)
  );
}

export async function saveCustomers(barId: string, customers: CustomerRecord[]) {
  await setBarStoredSetting(barId, "crm-customers", customers);
  return customers;
}

export async function createCustomer(barId: string, input: Omit<CustomerRecord, "id" | "createdAt">) {
  const current = await getCustomers(barId);
  const nextItem = customerRecordSchema.parse({
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString()
  });
  await saveCustomers(barId, [nextItem, ...current]);
  return nextItem;
}

export async function updateCustomer(barId: string, id: string, input: Partial<CustomerRecord>) {
  const current = await getCustomers(barId);
  const next = current.map((item) => (
    item.id === id
      ? customerRecordSchema.parse({ ...item, ...input, id: item.id, createdAt: item.createdAt })
      : item
  ));
  await saveCustomers(barId, next);
  return next.find((item) => item.id === id) ?? null;
}

export async function deleteCustomer(barId: string, id: string) {
  const current = await getCustomers(barId);
  const next = current.filter((item) => item.id !== id);
  await saveCustomers(barId, next);
  return { ok: true };
}

export async function getCustomerInsights(barId: string) {
  const customers = await getCustomers(barId);
  const active = customers.filter((item) => item.status !== "INATIVO");
  const vip = customers.filter((item) => item.status === "VIP");
  const fromWhatsapp = customers.filter((item) => item.origin === "WHATSAPP");
  const averageTicket = active.length
    ? active.reduce((sum, item) => sum + item.averageTicket, 0) / active.length
    : 0;

  return {
    cards: [
      { label: "Clientes cadastrados", value: customers.length },
      { label: "Clientes ativos", value: active.length },
      { label: "Clientes VIP", value: vip.length },
      { label: "Ticket medio CRM", value: averageTicket }
    ],
    highlights: {
      whatsappLeads: fromWhatsapp.length,
      frequentCustomers: customers.filter((item) => item.visitCount >= 3).length,
      inactiveCustomers: customers.filter((item) => item.status === "INATIVO").length
    }
  };
}

export async function getSaasClients(search?: string) {
  const stored = await getStoredSetting("saas-clients", DEFAULT_SAAS_CLIENTS);
  const clients = stored.map((item) => saasClientSchema.parse(item));

  if (!search) {
    return clients;
  }

  const normalized = search.toLowerCase();
  return clients.filter((item) =>
    item.businessName.toLowerCase().includes(normalized) ||
    item.contactName.toLowerCase().includes(normalized) ||
    item.phone.toLowerCase().includes(normalized) ||
    item.email.toLowerCase().includes(normalized)
  );
}

export async function saveSaasClients(clients: SaasClientRecord[]) {
  await setStoredSetting("saas-clients", clients);
  return clients;
}

type CreateSaasClientInput = Omit<SaasClientRecord, "id" | "createdAt" | "linkedBarId" | "linkedUserId" | "linkedUserEmail"> &
  Partial<Pick<SaasClientRecord, "linkedBarId" | "linkedUserId" | "linkedUserEmail">>;

export async function createSaasClient(input: CreateSaasClientInput) {
  const current = await getSaasClients();
  const desiredLogin = slugifyAccess(input.accessLogin || input.businessName) || `cliente${current.length + 1}`;
  const defaultBusinessName = input.businessName?.trim() || `Restaurante ${desiredLogin}`;
  const defaultContactName = input.contactName?.trim() || desiredLogin;
  const barSlug = await createUniqueBarSlug(desiredLogin);
  const userEmail = await createUniqueUserEmail(desiredLogin);
  const hashedPassword = await hashPassword(input.temporaryPassword || "12345");

  const created = await prisma.$transaction(async (tx) => {
    const bar = await tx.bar.create({
      data: {
        name: defaultBusinessName,
        slug: barSlug,
        phone: input.phone || "",
        address: ""
      }
    });

    const user = await tx.user.create({
      data: {
        name: defaultContactName,
        email: userEmail,
        passwordHash: hashedPassword,
        role: "ADMIN",
        active: input.accessStatus !== "BLOQUEADO"
      }
    });

    await tx.userBar.create({
      data: {
        userId: user.id,
        barId: bar.id
      }
    });

    await Promise.all(
      Array.from({ length: 12 }).map((_, index) =>
        tx.restaurantTable.create({
          data: {
            number: index + 1,
            name: `Mesa ${index + 1}`,
            barId: bar.id,
            qrCodeToken: randomUUID()
          }
        })
      )
    );

    return { bar, user };
  });

  const nextItem = saasClientSchema.parse({
    ...input,
    businessName: defaultBusinessName,
    contactName: defaultContactName,
    accessLogin: desiredLogin,
    temporaryPassword: input.temporaryPassword || "12345",
    linkedBarId: created.bar.id,
    linkedUserId: created.user.id,
    linkedUserEmail: created.user.email,
    id: randomUUID(),
    createdAt: new Date().toISOString()
  });
  await saveSaasClients([nextItem, ...current]);
  return nextItem;
}

export async function updateSaasClient(id: string, input: Partial<SaasClientRecord>) {
  const current = await getSaasClients();
  const currentClient = current.find((item) => item.id === id) ?? null;
  if (!currentClient) {
    return null;
  }

  const nextLogin = input.accessLogin ? slugifyAccess(input.accessLogin) : currentClient.accessLogin;
  const nextUserEmail = nextLogin ? `${nextLogin}@cliente.rtpg.local` : currentClient.linkedUserEmail;

  if (currentClient.linkedBarId) {
    await prisma.bar.update({
      where: { id: currentClient.linkedBarId },
      data: {
        name: input.businessName ?? currentClient.businessName
      }
    });
  }

  if (currentClient.linkedUserId) {
    const updateData: {
      name?: string;
      email?: string;
      active?: boolean;
      passwordHash?: string;
    } = {
      name: input.contactName ?? currentClient.contactName,
      active: (input.accessStatus ?? currentClient.accessStatus) !== "BLOQUEADO"
    };

    if (input.accessLogin && nextUserEmail !== currentClient.linkedUserEmail) {
      const existing = await prisma.user.findUnique({ where: { email: nextUserEmail } });
      if (!existing || existing.id === currentClient.linkedUserId) {
        updateData.email = nextUserEmail;
      }
    }

    if (input.temporaryPassword) {
      updateData.passwordHash = await hashPassword(input.temporaryPassword);
    }

    await prisma.user.update({
      where: { id: currentClient.linkedUserId },
      data: updateData
    });
  }

  const next = current.map((item) => {
    if (item.id !== id) return item;
    return saasClientSchema.parse({
      ...item,
      ...input,
      accessLogin: nextLogin,
      linkedUserEmail: input.accessLogin ? nextUserEmail : item.linkedUserEmail,
      id: item.id,
      createdAt: item.createdAt
    });
  });
  await saveSaasClients(next);
  return next.find((item) => item.id === id) ?? null;
}

export async function updateSaasClientByLinkedUser(userId: string, input: Partial<SaasClientRecord>) {
  const current = await getSaasClients();
  const target = current.find((item) => item.linkedUserId === userId);
  if (!target) {
    return null;
  }
  return updateSaasClient(target.id, input);
}

export async function registerSaasPayment(clientId: string, input: Omit<SaasPaymentRecord, "id">) {
  const current = await getSaasClients();
  const next = current.map((item) => {
    if (item.id !== clientId) return item;

    const payment = saasPaymentSchema.parse({
      ...input,
      id: randomUUID()
    });

    return saasClientSchema.parse({
      ...item,
      lastPaymentDate: input.paidAt,
      payments: [payment, ...item.payments],
      status: item.status === "CANCELADO" ? "CANCELADO" : "ATIVO",
      accessStatus: item.status === "CANCELADO" ? item.accessStatus : "LIBERADO"
    });
  });

  await saveSaasClients(next);
  return next.find((item) => item.id === clientId) ?? null;
}

export async function deleteSaasClient(id: string) {
  const current = await getSaasClients();
  const next = current.filter((item) => item.id !== id);
  await saveSaasClients(next);
  return { ok: true };
}

export async function getSaasOverview() {
  const clients = await getSaasClients();
  const active = clients.filter((item) => item.status === "ATIVO");
  const overdue = clients.filter((item) => item.status === "ATRASADO");
  const blocked = clients.filter((item) => item.accessStatus === "BLOQUEADO");
  const mrr = active.reduce((sum, item) => sum + item.monthlyFee, 0);
  const totalRevenue = clients.reduce((sum, item) => sum + item.payments.reduce((acc, payment) => acc + payment.amount, 0), 0);

  return {
    cards: [
      { label: "Clientes SaaS", value: clients.length },
      { label: "MRR estimado", value: mrr },
      { label: "Receita acumulada", value: totalRevenue },
      { label: "Em atraso", value: overdue.length }
    ],
    summary: {
      activeCount: active.length,
      overdueCount: overdue.length,
      blockedCount: blocked.length,
      totalRevenue,
      mrr
    }
  };
}

function isSameMonth(dateString: string, reference: Date) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

function diffInDays(dateString: string, reference: Date) {
  if (!dateString) return null;
  const target = new Date(dateString);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((target.getTime() - reference.getTime()) / msPerDay);
}

export async function getOwnerManagerDashboard() {
  const clients = await getSaasClients();
  const today = new Date();
  const topRevenue = [...clients]
    .sort(
      (a, b) =>
        b.payments.reduce((sum, payment) => sum + payment.amount, 0) -
        a.payments.reduce((sum, payment) => sum + payment.amount, 0)
    )
    .slice(0, 5);

  const monthlyRevenue = clients.reduce((sum, client) => {
    return sum + client.payments.filter((payment) => isSameMonth(payment.paidAt, today)).reduce((acc, payment) => acc + payment.amount, 0);
  }, 0);

  const accumulatedRevenue = clients.reduce((sum, client) => sum + client.payments.reduce((acc, payment) => acc + payment.amount, 0), 0);
  const dueToday = clients.filter((client) => diffInDays(client.nextDueDate, today) === 0);
  const dueTomorrow = clients.filter((client) => diffInDays(client.nextDueDate, today) === 1);
  const dueThisWeek = clients.filter((client) => {
    const days = diffInDays(client.nextDueDate, today);
    return days !== null && days >= 0 && days <= 7;
  });
  const overdue = clients.filter((client) => client.status === "ATRASADO");
  const blocked = clients.filter((client) => client.accessStatus === "BLOQUEADO");
  const mrr = clients.filter((client) => client.status === "ATIVO").reduce((sum, client) => sum + client.monthlyFee, 0);

  return {
    cards: [
      { label: "MRR estimado", value: mrr },
      { label: "Receita do mes", value: monthlyRevenue },
      { label: "Receita acumulada", value: accumulatedRevenue },
      { label: "Clientes ativos", value: clients.filter((client) => client.status === "ATIVO").length }
    ],
    actions: {
      dueToday: dueToday.length,
      dueTomorrow: dueTomorrow.length,
      overdue: overdue.length,
      blocked: blocked.length,
      dueThisWeek: dueThisWeek.length
    },
    lists: {
      dueToday,
      dueTomorrow,
      overdue,
      blocked,
      dueThisWeek
    },
    topRevenue
  };
}
