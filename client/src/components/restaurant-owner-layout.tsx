import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { roleLabelMap } from "../lib/roles";
import { useAuth } from "../state/auth";
import { useBar } from "../state/bar";
import { useThemeSettings } from "../state/theme";
import { FullscreenToggle } from "./fullscreen-toggle";

const subNav = [
  { to: "/painel-dono/mesas", label: "Mesas e vendas" },
  { to: "/painel-dono/produtos", label: "Cardapio" },
  { to: "/painel-dono/insumos", label: "Insumos" },
  { to: "/painel-dono/estoque", label: "Estoque" },
  { to: "/painel-dono/dre", label: "DRE" },
  { to: "/painel-dono/whatsapp", label: "WhatsApp" },
  { to: "/painel-dono/modulos", label: "Modulos" }
];

export function RestaurantOwnerLayout() {
  const { user, logout } = useAuth();
  const { bars, activeBarId } = useBar();
  const { logoUrl } = useThemeSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const isHub = location.pathname === "/painel-dono" || location.pathname === "/painel-dono/";
  const activeBar = bars.find((bar) => bar.id === activeBarId) ?? bars[0];
  const restaurantName = activeBar?.name || "Restaurante";

  return (
    <div className="theme-shell min-h-screen bg-[var(--color-background)]">
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--color-surface) 94%, transparent)",
          borderColor: "var(--color-border)"
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/painel-dono" className="flex items-center gap-3 font-bold text-[var(--color-primary)]">
              {logoUrl ? (
                <img src={logoUrl} alt={restaurantName} className="h-12 w-12 rounded-2xl object-cover" />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black"
                  style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
                >
                  {restaurantName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className="block truncate text-lg">{restaurantName}</span>
                <span className="block text-xs font-medium text-muted">Painel do restaurante</span>
              </div>
            </Link>
            {!isHub ? (
              <Link
                to="/painel-dono"
                className="rounded-full border px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-black/[0.04]"
                style={{ borderColor: "var(--color-border)" }}
              >
                Voltar ao painel
              </Link>
            ) : null}
          </div>

          <nav className="flex flex-wrap items-center gap-1 text-sm font-medium" aria-label="Operacao">
            {subNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 transition ${isActive ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "text-muted hover:bg-black/[0.05]"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs text-muted sm:inline">{user?.name}</span>
            <FullscreenToggle compact />
            <button
              type="button"
              className="btn-secondary px-3 py-2 text-sm"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">
        <p className="mb-4 text-xs text-muted">
          {user?.role ? roleLabelMap[user.role] : ""} Â· ambiente do restaurante, com operacao, estoque, financeiro e DRE
        </p>
        <Outlet />
      </main>
    </div>
  );
}

