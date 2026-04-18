import { z } from "zod";

export const branchSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  code: z.string().min(2),
  city: z.string().default(""),
  state: z.string().default(""),
  active: z.boolean().default(true),
  timezone: z.string().default("America/Sao_Paulo"),
  serviceFee: z.number().default(0),
  deliveryFee: z.number().default(0),
  channels: z.array(z.enum(["SALAO", "BALCAO", "DELIVERY", "WHATSAPP", "QR"])).default(["SALAO", "BALCAO", "QR"])
});

export const organizationSchema = z.object({
  companyName: z.string().min(2),
  tradeName: z.string().min(2),
  cnpj: z.string().default(""),
  operationModel: z.enum(["MONOUNIDADE", "MULTIUNIDADE_PREPARADO"]).default("MONOUNIDADE"),
  primaryFocus: z.enum(["HIBRIDO", "SALAO", "DELIVERY", "BAR", "RESTAURANTE"]).default("HIBRIDO"),
  branches: z.array(branchSchema).default([]),
  channelsEnabled: z.array(z.enum(["SALAO", "BALCAO", "DELIVERY", "WHATSAPP", "QR"])).default(["SALAO", "BALCAO", "QR"]),
  whatsappAutomationEnabled: z.boolean().default(false)
});

export const financeTitleSchema = z.object({
  id: z.string(),
  kind: z.enum(["PAGAR", "RECEBER"]),
  description: z.string().min(2),
  category: z.string().min(2),
  branchId: z.string().default("branch-main"),
  costCenter: z.string().default("OPERACAO"),
  amount: z.number().positive(),
  dueDate: z.string(),
  status: z.enum(["PENDENTE", "PAGO", "VENCIDO", "CANCELADO", "PARCIAL"]).default("PENDENTE"),
  counterparty: z.string().default(""),
  notes: z.string().default(""),
  createdAt: z.string()
});

export const aiPanelSchema = z.object({
  assistantName: z.string().default("RTPG AI"),
  channels: z.array(z.enum(["WHATSAPP", "INSTAGRAM", "QR"])).default(["WHATSAPP", "QR"]),
  autoReplyEnabled: z.boolean().default(true),
  audioTranscriptionEnabled: z.boolean().default(true),
  handoffThreshold: z.number().min(0).max(100).default(65),
  upsellEnabled: z.boolean().default(true),
  estimatedAutomationRate: z.number().min(0).max(100).default(42),
  handoffReasons: z.array(z.string()).default([
    "Cliente pediu desconto fora da politica",
    "Problema com pagamento",
    "Reclamacao sensivel",
    "Endereco fora da area de entrega"
  ])
});

export const cashierMovementSchema = z.object({
  id: z.string(),
  type: z.enum(["SANGRIA", "REFORCO", "AJUSTE"]),
  amount: z.number().positive(),
  reason: z.string().min(2),
  createdAt: z.string()
});

export const cashierSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  branchId: z.string().default("branch-main"),
  status: z.enum(["ABERTO", "FECHADO"]),
  openingAmount: z.number().min(0),
  closingAmount: z.number().min(0).default(0),
  expectedAmount: z.number().min(0).default(0),
  divergenceAmount: z.number().default(0),
  openedAt: z.string(),
  closedAt: z.string().optional(),
  justification: z.string().default(""),
  movements: z.array(cashierMovementSchema).default([])
});

export const customerRecordSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  phone: z.string().default(""),
  email: z.string().default(""),
  instagram: z.string().default(""),
  city: z.string().default(""),
  birthDate: z.string().default(""),
  preferredChannel: z.enum(["WHATSAPP", "INSTAGRAM", "QR", "BALCAO", "SALAO", "DELIVERY"]).default("WHATSAPP"),
  origin: z.enum(["WHATSAPP", "INSTAGRAM", "QR", "BALCAO", "SALAO", "DELIVERY", "MANUAL"]).default("MANUAL"),
  status: z.enum(["ATIVO", "INATIVO", "VIP"]).default("ATIVO"),
  averageTicket: z.number().min(0).default(0),
  visitCount: z.number().int().min(0).default(0),
  lastOrderAt: z.string().default(""),
  notes: z.string().default(""),
  tags: z.array(z.string()).default([]),
  createdAt: z.string()
});

export const saasPaymentSchema = z.object({
  id: z.string(),
  amount: z.number().min(0),
  paidAt: z.string(),
  referenceMonth: z.string().default(""),
  notes: z.string().default("")
});

export const saasClientSchema = z.object({
  id: z.string(),
  businessName: z.string().min(2),
  contactName: z.string().min(2),
  accessLogin: z.string().min(2).default(""),
  temporaryPassword: z.string().min(5).default("12345"),
  linkedBarId: z.string().default(""),
  linkedUserId: z.string().default(""),
  linkedUserEmail: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  cpfCnpj: z.string().default(""),
  planName: z.string().default("Plano Base"),
  monthlyFee: z.number().min(0).default(0),
  billingDay: z.number().int().min(1).max(31).default(10),
  nextDueDate: z.string(),
  lastPaymentDate: z.string().default(""),
  status: z.enum(["ATIVO", "TRIAL", "ATRASADO", "SUSPENSO", "CANCELADO"]).default("TRIAL"),
  accessStatus: z.enum(["LIBERADO", "BLOQUEIO_AVISO", "BLOQUEADO"]).default("LIBERADO"),
  notes: z.string().default(""),
  payments: z.array(saasPaymentSchema).default([]),
  asaasCustomerId: z.string().default(""),
  asaasSubscriptionId: z.string().default(""),
  createdAt: z.string()
});

export type OrganizationSetting = z.infer<typeof organizationSchema>;
export type FinanceTitle = z.infer<typeof financeTitleSchema>;
export type AiPanelSetting = z.infer<typeof aiPanelSchema>;
export type CashierMovement = z.infer<typeof cashierMovementSchema>;
export type CashierSession = z.infer<typeof cashierSessionSchema>;
export type CustomerRecord = z.infer<typeof customerRecordSchema>;
export type SaasPaymentRecord = z.infer<typeof saasPaymentSchema>;
export type SaasClientRecord = z.infer<typeof saasClientSchema>;
