import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";

const STORAGE_KEY = "rtpg_onboarding_done";

type Step = {
  id: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
};

const STEPS: Step[] = [
  {
    id: "products",
    title: "Cadastre seus produtos",
    desc: "Crie as categorias e os itens do seu cardapio com preco, foto e descricao.",
    href: "/painel-dono/produtos",
    cta: "Ir para Produtos",
  },
  {
    id: "supplies",
    title: "Adicione insumos",
    desc: "Cadastre os insumos que compoem cada prato para controlar o CMV e o estoque.",
    href: "/painel-dono/insumos",
    cta: "Ir para Insumos",
  },
  {
    id: "tables",
    title: "Configure as mesas",
    desc: "Ajuste a quantidade e os nomes das mesas ou balcoes do seu ambiente.",
    href: "/painel-dono/mesas",
    cta: "Ir para Mesas",
  },
  {
    id: "team",
    title: "Cadastre sua equipe",
    desc: "Adicione garcons, caixas e cozinheiros com acesso limitado ao papel deles.",
    href: "/painel-dono/equipe",
    cta: "Ir para Equipe",
  },
  {
    id: "qrcode",
    title: "Gere os QR Codes",
    desc: "Cada mesa pode ter um QR Code para o cliente ver o cardapio ou fazer pedido.",
    href: "/painel-dono/qrcodes",
    cta: "Ir para QR Codes",
  },
  {
    id: "cashier",
    title: "Abra o caixa e venda",
    desc: "Abra o caixa do dia, lance pedidos nas mesas e acompanhe o movimento em tempo real.",
    href: "/painel-dono/caixa",
    cta: "Ir para o Caixa",
  },
];

export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + "_steps");
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(STORAGE_KEY + "_steps", JSON.stringify([...next]));
      return next;
    });
  }

  function finish() {
    localStorage.setItem(STORAGE_KEY, "true");
    navigate("/painel-dono");
  }

  const done = checked.size;
  const total = STEPS.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="min-h-screen bg-[#fffaf2] flex flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#8f5f31]">Bem-vindo ao RTPG</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-[#21170f]">
            Ola{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Vamos configurar seu restaurante.
          </h1>
          <p className="mt-3 text-stone-600">
            Siga os passos abaixo para comecar a operar. Voce pode voltar aqui a qualquer momento.
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-sm font-bold text-stone-600 mb-2">
            <span>{done} de {total} concluidos</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-[#e3d4bf] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#c99a2e] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const done = checked.has(step.id);
            return (
              <div
                key={step.id}
                className="flex items-start gap-4 rounded-2xl border p-5 transition"
                style={{
                  borderColor: done ? "#c99a2e" : "#e3d4bf",
                  background: done ? "color-mix(in srgb, #c99a2e 8%, #fffaf2)" : "#ffffff",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(step.id)}
                  className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition"
                  style={{
                    borderColor: done ? "#c99a2e" : "#8f5f31",
                    background: done ? "#c99a2e" : "transparent",
                    color: "#fff",
                  }}
                  aria-label={done ? "Desmarcar" : "Marcar como feito"}
                >
                  {done && (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#8f5f31]">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="font-black text-[#21170f]" style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-stone-600">{step.desc}</p>
                </div>

                <a
                  href={step.href}
                  className="flex-shrink-0 rounded-full border border-[#21170f] px-4 py-1.5 text-sm font-black text-[#21170f] transition hover:bg-[#21170f] hover:text-white"
                >
                  {step.cta}
                </a>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            className="rounded-full bg-[#c99a2e] px-8 py-4 font-black text-[#21170f] shadow-[0_8px_24px_rgba(201,154,46,0.28)] transition hover:bg-[#d8aa40]"
            onClick={finish}
          >
            {done === total ? "Concluir configuracao" : "Comecar a usar mesmo assim"}
          </button>
          <a
            href="/painel-dono"
            className="rounded-full border border-[#21170f] px-8 py-4 text-center font-black text-[#21170f] transition hover:bg-[#21170f] hover:text-white"
          >
            Ir para o painel
          </a>
        </div>
      </div>
    </div>
  );
}

export function shouldShowOnboarding(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}
