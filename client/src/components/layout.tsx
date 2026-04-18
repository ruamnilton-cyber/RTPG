import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AppRole, hasRoleAccess, roleLabelMap } from "../lib/roles";
import { useAuth } from "../state/auth";
import { useThemeSettings } from "../state/theme";

const menu: Array<{ to: string; label: string; roles?: AppRole[] }> = [
  { to: "/", label: "Dashboard" },
  { to: "/meu-gestor", label: "Meu Gestor", roles: ["ADMIN"] },
  { to: "/organizacao", label: "Organizacao", roles: ["ADMIN", "GERENTE"] },
  { to: "/pedidos", label: "Pedidos", roles: ["ADMIN", "GERENTE", "GARCOM", "CAIXA", "OPERADOR"] },
  { to: "/mesas", label: "Mesas", roles: ["ADMIN", "GERENTE", "GARCOM", "CAIXA", "OPERADOR"] },
  { to: "/cozinha", label: "Cozinha / Bar", roles: ["ADMIN", "GERENTE", "COZINHA"] },
  { to: "/produtos", label: "Cardápio", roles: ["ADMIN", "GERENTE", "CAIXA", "OPERADOR"] },
  { to: "/insumos", label: "Insumos", roles: ["ADMIN", "GERENTE"] },
  { to: "/fichas", label: "Ficha técnica", roles: ["ADMIN", "GERENTE"] },
  { to: "/estoque", label: "Estoque", roles: ["ADMIN", "GERENTE", "FINANCEIRO"] },
  { to: "/clientes", label: "Clientes", roles: ["ADMIN", "GERENTE", "CAIXA", "GARCOM", "OPERADOR"] },
  { to: "/caixa", label: "Caixa", roles: ["ADMIN", "GERENTE", "CAIXA", "FINANCEIRO"] },
  { to: "/financeiro", label: "Financeiro", roles: ["ADMIN", "GERENTE", "FINANCEIRO"] },
  { to: "/dre", label: "DRE", roles: ["ADMIN", "GERENTE", "FINANCEIRO"] },
  { to: "/relatorios", label: "Relatórios", roles: ["ADMIN", "GERENTE", "FINANCEIRO"] },
  { to: "/whatsapp", label: "WhatsApp", roles: ["ADMIN", "GERENTE", "CAIXA", "OPERADOR"] },
  { to: "/ia", label: "Painel IA", roles: ["ADMIN", "GERENTE"] },
  { to: "/qrcodes", label: "QR Codes", roles: ["ADMIN", "GERENTE", "GARCOM", "OPERADOR"] },
  { to: "/reservas", label: "Reservas", roles: ["ADMIN", "GERENTE", "GARCOM", "CAIXA"] },
  { to: "/usuarios", label: "Usuários", roles: ["ADMIN"] },
  { to: "/configuracoes", label: "Configurações", roles: ["ADMIN", "GERENTE"] }
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { logoUrl } = useThemeSettings();
  const navigate = useNavigate();

  return (
    <div className="theme-shell min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1500px] gap-6 p-4">
        <aside
          className="hidden w-80 rounded-[2rem] p-6 text-white shadow-card xl:block"
          style={{ background: "var(--color-menu)", border: "1px solid var(--color-border)" }}
        >
          <div>
            {logoUrl ? <img src={logoUrl} alt="Logo do estabelecimento" className="mb-4 h-16 w-16 rounded-3xl object-cover" /> : null}
            <p className="text-sm uppercase tracking-[0.35em]" style={{ color: "var(--color-secondary)" }}>RTPG Gestão</p>
            <h1 className="mt-3 text-3xl font-bold">Plataforma de gestão</h1>
            <p className="mt-3 text-sm text-muted">Operação, cardápio, salão, estoque, caixa e inteligência financeira em um produto único.</p>
          </div>

          <nav className="mt-8 grid gap-2">
            {menu
              .filter((item) => hasRoleAccess(user?.role, item.roles))
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium transition"
                  style={({ isActive }) => ({
                    background: isActive ? "var(--color-primary)" : "transparent",
                    color: isActive ? "#ffffff" : "var(--color-text)"
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
          </nav>
        </aside>

        <main className="flex-1">
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[2rem] p-4 shadow-card backdrop-blur"
            style={{ background: "color-mix(in srgb, var(--color-surface) 92%, transparent)", border: "1px solid var(--color-border)" }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>Sessão ativa</p>
              <h2 className="text-xl font-bold">{user?.name}</h2>
              <p className="text-sm text-muted">{user?.email} • {user?.role ? roleLabelMap[user.role] : ""}</p>
            </div>
            <button
              className="btn-secondary"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sair
            </button>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
