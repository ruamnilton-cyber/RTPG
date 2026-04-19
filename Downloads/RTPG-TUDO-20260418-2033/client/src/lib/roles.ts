export const roleOptions = [
  { value: "ADMIN", label: "Proprietário / Admin" },
  { value: "GERENTE", label: "Gerente" },
  { value: "CAIXA", label: "Operador / Caixa" },
  { value: "GARCOM", label: "Garçom" },
  { value: "COZINHA", label: "Cozinha / Bar" },
  { value: "FINANCEIRO", label: "Financeiro" },
  { value: "OPERADOR", label: "Operador" }
] as const;

export type AppRole = (typeof roleOptions)[number]["value"];

export const roleLabelMap: Record<AppRole, string> = roleOptions.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<AppRole, string>);

export function hasRoleAccess(role: AppRole | undefined, allowedRoles?: AppRole[]) {
  if (!allowedRoles?.length) {
    return true;
  }

  return role ? allowedRoles.includes(role) : false;
}
