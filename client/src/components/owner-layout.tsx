import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { FullscreenToggle } from "./fullscreen-toggle";

const ownerMenu = [
  { to: "/meu-gestor", label: "Resumo" },
  { to: "/meu-gestor/carteira", label: "Carteira" }
];

export function OwnerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen px-4 py-5"
      style={{
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 95%, #ffffff), var(--color-background))"
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-[1450px] gap-6">
        <aside
          className="hidden w-80 rounded-[2rem] p-6 xl:flex xl:flex-col xl:justify-between"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: "var(--color-primary)" }}>
                Meu Gestor
              </p>
              <h1 className="text-3xl font-bold">Painel do dono</h1>
              <p className="text-sm text-muted">
                Sua operacao SaaS separada do sistema do restaurante: carteira, cobranca, vencimentos e receita.
              </p>
            </div>

            <nav className="grid gap-2">
              {ownerMenu.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/meu-gestor"}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                  style={({ isActive }) => ({
                    background: isActive ? "var(--color-primary)" : "var(--color-surface-alt)",
                    color: isActive ? "var(--color-on-primary)" : "var(--color-text)"
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="space-y-3 rounded-[1.75rem] p-4 surface-soft">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Sessao</p>
              <strong className="block text-lg">{user?.name}</strong>
              <p className="text-sm text-muted">{user?.email}</p>
            </div>
            <div className="flex gap-2">
              <FullscreenToggle />
              <button className="btn-secondary flex-1" onClick={() => navigate("/painel-dono")}>
                Abrir restaurante
              </button>
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
          </div>
        </aside>

        <main className="flex-1">
          <div
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[2rem] p-4 xl:hidden"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-card)" }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>
                Meu Gestor
              </p>
              <h2 className="text-2xl font-bold">Carteira e receita</h2>
            </div>
            <div className="flex gap-2">
              <FullscreenToggle />
              <button className="btn-secondary" onClick={() => navigate("/painel-dono")}>
                Restaurante
              </button>
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
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
