import { AppRole, hasRoleAccess } from "../lib/roles";

export type MenuItem = { to: string; label: string; shortLabel?: string; roles?: AppRole[]; emoji?: string };

/** Lista completa (ordem importa dentro de cada grupo). */
export const allMenuItems: MenuItem[] = [
  { to: "/", label: "InÃ­cio", shortLabel: "InÃ­cio", emoji: "âŒ‚", roles: undefined },
  { to: "/pedidos", label: "Pedidos", shortLabel: "Pedidos", emoji: "ðŸ“‹", roles: ["ADMIN", "GERENTE", "GARCOM", "CAIXA", "OPERADOR", "COZINHA"] },
  { to: "/mesas", label: "Mesas", shortLabel: "Mesas", emoji: "ðŸ½", roles: ["ADMIN", "GERENTE", "GARCOM", "CAIXA", "OPERADOR"] },
  { to: "/produtos", label: "CardÃ¡pio", shortLabel: "CardÃ¡pio", emoji: "ðŸ“–", roles: ["ADMIN", "GERENTE", "CAIXA", "OPERADOR"] },
  { to: "/cozinha", label: "Cozinha / Bar", shortLabel: "Cozinha", emoji: "ðŸ‘¨â€ðŸ³", roles: ["ADMIN", "GERENTE", "COZINHA"] },
  { to: "/caixa", label: "Caixa", shortLabel: "Caixa", emoji: "ðŸ’µ", roles: ["ADMIN", "GERENTE", "CAIXA", "FINANCEIRO"] },
  { to: "/clientes", label: "Clientes", shortLabel: "Clientes", emoji: "ðŸ‘¤", roles: ["ADMIN", "GERENTE", "CAIXA", "GARCOM", "OPERADOR"] },
  { to: "/qrcodes", label: "QR Codes", shortLabel: "QR", emoji: "â–¦", roles: ["ADMIN", "GERENTE", "GARCOM", "OPERADOR"] },
  { to: "/financeiro", label: "Financeiro", shortLabel: "Financ.", emoji: "ðŸ“Š", roles: ["ADMIN", "GERENTE", "FINANCEIRO"] },
  { to: "/dre", label: "DRE", shortLabel: "DRE", emoji: "ðŸ“ˆ", roles: ["ADMIN", "GERENTE", "FINANCEIRO"] },
  { to: "/relatorios", label: "RelatÃ³rios", shortLabel: "Relat.", emoji: "ðŸ“‘", roles: ["ADMIN", "GERENTE", "FINANCEIRO"] },
  { to: "/modulos", label: "Modulos", shortLabel: "Modulos", emoji: "*", roles: ["ADMIN", "GERENTE"] },
  { to: "/estoque", label: "Estoque", emoji: "ðŸ“¦", roles: ["ADMIN", "GERENTE", "FINANCEIRO"] },
  { to: "/insumos", label: "Insumos", emoji: "ðŸ¥¬", roles: ["ADMIN", "GERENTE"] },
  { to: "/fichas", label: "Ficha tÃ©cnica", emoji: "ðŸ“", roles: ["ADMIN", "GERENTE"] },
  { to: "/reservas", label: "Reservas", emoji: "ðŸ“…", roles: ["ADMIN", "GERENTE", "GARCOM", "CAIXA"] },
  { to: "/ia", label: "Painel IA", emoji: "âœ¨", roles: ["ADMIN", "GERENTE"] },
  { to: "/organizacao", label: "OrganizaÃ§Ã£o", emoji: "ðŸ¢", roles: ["ADMIN", "GERENTE"] },
  { to: "/configuracoes", label: "ConfiguraÃ§Ãµes", emoji: "âš™", roles: ["ADMIN", "GERENTE"] },
  { to: "/bares", label: "Bares", emoji: "ðŸº", roles: ["ADMIN"] },
  { to: "/usuarios", label: "UsuÃ¡rios", emoji: "ðŸ‘¥", roles: ["ADMIN"] },
  { to: "/sistema", label: "Controle do sistema", emoji: "ðŸ›¡", roles: ["ADMIN"] },
  { to: "/meu-gestor", label: "Meu Gestor", emoji: "ðŸ’¼", roles: ["ADMIN"] }
];

/** Ordem de prioridade para o modo â€œquiosqueâ€: no mÃ¡ximo `maxPrimary` itens nesta ordem. */
const PRIORITY_PATHS = [
  "/",
  "/pedidos",
  "/mesas",
  "/produtos",
  "/cozinha",
  "/caixa",
  "/clientes",
  "/qrcodes",
  "/financeiro",
  "/dre",
  "/relatorios"
];

const MAX_PRIMARY = 6;
const MAX_PRIMARY_MOBILE = 5;

export function partitionMenu(role: AppRole | undefined, maxPrimary = MAX_PRIMARY) {
  const allowed = allMenuItems.filter((item) => hasRoleAccess(role, item.roles));
  const primary: MenuItem[] = [];
  const seen = new Set<string>();

  for (const path of PRIORITY_PATHS) {
    if (primary.length >= maxPrimary) break;
    const item = allowed.find((m) => m.to === path);
    if (item && !seen.has(item.to)) {
      primary.push(item);
      seen.add(item.to);
    }
  }

  const extra = allowed.filter((m) => !seen.has(m.to));
  return { primary, extra };
}

export function gestaoExpandedDefault(role: AppRole | undefined) {
  return role === "ADMIN" || role === "GERENTE";
}

export { MAX_PRIMARY_MOBILE };

