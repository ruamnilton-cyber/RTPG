export type BillingCycle = "monthly" | "annual";
export type SubscriptionPlanId = "basic" | "professional" | "enterprise";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  audience: string;
  monthlyPrice: number;
  terminalLimit: number | "unlimited";
  highlighted?: boolean;
  badge?: string;
  features: string[];
};

export const SUBSCRIPTION_TRIAL_DAYS = 14;
export const ANNUAL_DISCOUNT_RATE = 0.2;

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "basic",
    name: "Basico",
    audience: "Para restaurantes pequenos",
    monthlyPrice: 149,
    terminalLimit: 1,
    features: ["Ate 1 terminal", "Gestao de pedidos", "Relatorios basicos", "Suporte por e-mail"]
  },
  {
    id: "professional",
    name: "Profissional",
    audience: "Para operacoes em crescimento",
    monthlyPrice: 299,
    terminalLimit: 3,
    highlighted: true,
    badge: "Mais popular",
    features: ["Ate 3 terminais", "Tudo do Basico", "Controle de estoque", "Integracao com delivery", "Suporte prioritario"]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "Para redes e multiunidades",
    monthlyPrice: 599,
    terminalLimit: "unlimited",
    features: ["Terminais ilimitados", "Tudo do Profissional", "Multi-unidades", "Relatorios avancados", "Gerente de conta dedicado"]
  }
];

export function getPlanById(planId: string | undefined) {
  return subscriptionPlans.find((plan) => plan.id === planId) ?? null;
}

export function getMonthlyEquivalentPrice(plan: SubscriptionPlan, billingCycle: BillingCycle) {
  return billingCycle === "annual" ? plan.monthlyPrice * (1 - ANNUAL_DISCOUNT_RATE) : plan.monthlyPrice;
}

export function getAnnualTotalPrice(plan: SubscriptionPlan) {
  return getMonthlyEquivalentPrice(plan, "annual") * 12;
}
