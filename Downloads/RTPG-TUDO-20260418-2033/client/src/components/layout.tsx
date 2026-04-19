import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { roleLabelMap } from "../lib/roles";
import { useAuth } from "../state/auth";
import { useBar } from "../state/bar";
import { useThemeSettings } from "../state/theme";
import { gestaoExpandedDefault, MAX_PRIMARY_MOBILE, partitionMenu, type MenuItem } from "./layout-menus";

function NavButton({
  item,
  end,
  large
}: {
  item: MenuItem;
  end?: boolean;
  large?: boolean;
}) {
  const label = item.shortLabel ?? item.label;
  return (
    <NavLink
      to={item.to}
      end={end}
      className={({ isActive }) =>
        [
          "block rounded-2xl font-semibold transition active:scale-[0.98]",
          large ? "min-h-[52px] flex items-center gap-3 px-4 py-3.5 text-base" : "px-3 py-2.5 text-sm"
        ].join(" ")
      }
      style={({ isActive }) => ({
        background: isActive ? "var(--color-primary)" : "transparent",
        color: isActive ? "var(--color-on-primary)" : "var(--color-on-menu)",
        border: isActive ? "none" : "1px solid color-mix(in srgb, var(--color-border) 40%, transparent)"
      })}
    >
      {item.emoji ? <span className="select-none text-xl leading-none">{item.emoji}</span> : null}
      <span>{label}</span>
    </NavLink>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { bars, activeBarId, setActiveBarId } = useBar();
  const { logoUrl } = useThemeSettings();
  const navigate = useNavigate();

  const { primary, extra } = useMemo(() => partitionMenu(user?.role, 6), [user?.role]);
  const primaryMobile = useMemo(() => partitionMenu(user?.role, MAX_PRIMARY_MOBILE).primary, [user?.role]);

  const [gestaoOpen, setGestaoOpen] = useState(() => gestaoExpandedDefault(user?.role));
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    setGestaoOpen(gestaoExpandedDefault(user?.role));
  }, [user?.role]);

  return (
    <div className="theme-shell min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1500px] gap-4 p-3 pb-[5.5rem] lg:gap-5 lg:p-4 lg:pb-4">
        <aside
          className="hidden w-[17rem] shrink-0 flex-col rounded-[1.75rem] p-4 shadow-card lg:flex xl:w-[18rem]"
          style={{ background: "var(--color-menu)", border: "1px solid var(--color-border)", color: "var(--color-on-menu)" }}
        >
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-12 w-12 rounded-2xl object-cover" />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold"
                style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                R
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-secondary)" }}>
                RTPG
              </p>
              <p className="text-sm font-semibold leading-tight" style={{ color: "var(--color-menu-muted)" }}>
                Toque para trabalhar
              </p>
            </div>
          </div>

          <nav className="mt-4 flex flex-col gap-2" aria-label="Atalhos principais">
            {primary.map((item) => (
              <NavButton key={item.to} item={item} end={item.to === "/"} large />
            ))}
          </nav>

          {extra.length > 0 ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/10"
                onClick={() => setGestaoOpen((o) => !o)}
                aria-expanded={gestaoOpen}
              >
                <span>Mais opções</span>
                <span className="text-muted" aria-hidden>
                  {gestaoOpen ? "▲" : "▼"}
                </span>
              </button>
              {gestaoOpen ? (
                <nav className="mt-2 flex max-h-[min(50vh,420px)] flex-col gap-1 overflow-y-auto pr-1" aria-label="Gestão e outras telas">
                  {extra.map((item) => (
                    <NavButton key={item.to} item={item} end={item.to === "/"} />
                  ))}
                </nav>
              ) : null}
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 flex-1">
          <div
            className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] p-3 shadow-card backdrop-blur sm:p-4"
            style={{ background: "color-mix(in srgb, var(--color-surface) 92%, transparent)", border: "1px solid var(--color-border)" }}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted">Operador</p>
              <h2 className="truncate text-lg font-bold sm:text-xl">{user?.name}</h2>
              <p className="truncate text-xs text-muted sm:text-sm">
                {user?.role ? roleLabelMap[user.role] : ""}
                {user?.email ? ` · ${user.email}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {bars.length > 0 ? (
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Bar
                  <select
                    className="input min-w-[160px] max-w-[220px] py-2 text-sm normal-case sm:min-w-[200px]"
                    value={activeBarId ?? ""}
                    onChange={(e) => setActiveBarId(e.target.value)}
                  >
                    {bars.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                className="btn-secondary whitespace-nowrap px-4 py-2 text-sm"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                Sair
              </button>
            </div>
          </div>

          <Outlet key={activeBarId ?? "sem-bar"} />
        </main>
      </div>

      {/* Barra inferior estilo terminal / quiosque (telas menores) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around gap-0 border-t bg-[var(--color-surface)] px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,.08)] lg:hidden"
        style={{ borderColor: "var(--color-border)" }}
        aria-label="Menu principal"
      >
        {primaryMobile.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold ${
                isActive ? "text-[var(--color-primary)]" : "text-muted"
              }`
            }
          >
            <span className="text-2xl leading-none" aria-hidden>
              {item.emoji ?? "·"}
            </span>
            <span className="truncate px-0.5">{item.shortLabel ?? item.label}</span>
          </NavLink>
        ))}
        {extra.length > 0 ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold text-muted"
            onClick={() => setMobileMoreOpen(true)}
          >
            <span className="text-2xl leading-none" aria-hidden>
              ⋯
            </span>
            <span>Mais</span>
          </button>
        ) : null}
      </nav>

      {mobileMoreOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/40 p-4 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Outras opções"
        >
          <div
            className="mt-auto max-h-[75vh] overflow-hidden rounded-3xl bg-[var(--color-surface)] shadow-card"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
              <span className="font-bold">Mais opções</span>
              <button type="button" className="rounded-xl px-3 py-1 text-sm font-semibold hover:bg-black/5" onClick={() => setMobileMoreOpen(false)}>
                Fechar
              </button>
            </div>
            <div className="grid max-h-[60vh] gap-1 overflow-y-auto p-3">
              {extra.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMoreOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-semibold hover:bg-black/[0.04]"
                >
                  <span className="text-2xl">{item.emoji ?? "▸"}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
