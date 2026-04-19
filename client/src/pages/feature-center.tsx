import { Link } from "react-router-dom";
import { PageHeader } from "../components/common";

type FeatureStatus = "operando" | "configuravel" | "integracao" | "proximo";

type FeatureItem = {
  name: string;
  description: string;
  status: FeatureStatus;
  path?: string;
  dependsOn?: string;
};

type FeaturePlan = {
  name: string;
  subtitle: string;
  items: FeatureItem[];
};

const statusMeta: Record<FeatureStatus, { label: string; tone: string }> = {
  operando: { label: "Ja no sistema", tone: "#16a34a" },
  configuravel: { label: "Pronto para configurar", tone: "#0ea5e9" },
  integracao: { label: "Depende de integracao", tone: "#f59e0b" },
  proximo: { label: "Proximo modulo", tone: "#a855f7" }
};

const plans: FeaturePlan[] = [
  {
    name: "Plano Basico",
    subtitle: "Nucleo operacional: vender, atender, comandar e medir o basico.",
    items: [
      {
        name: "Gestao basica",
        description: "Painel inicial, indicadores do dia, produtos, mesas e usuarios.",
        status: "operando",
        path: "/painel-dono"
      },
      {
        name: "PDV balcao / mesa",
        description: "Venda por mesa/comanda, lancamento visual de produtos e fechamento.",
        status: "operando",
        path: "/painel-dono/mesas"
      },
      {
        name: "Comandas individuais",
        description: "Controle dos itens da mesa com quantidades, observacoes e subtotal.",
        status: "operando",
        path: "/painel-dono/mesas"
      },
      {
        name: "Delivery proprio",
        description: "Base de pedidos por canal ja existe; falta tela dedicada de entrega, taxas e entregador.",
        status: "proximo",
        path: "/painel-dono/mesas"
      },
      {
        name: "Cardapio digital + QR Code",
        description: "QR Codes de mesa e cardapio publico por token da mesa.",
        status: "operando",
        path: "/painel-dono/qrcodes"
      },
      {
        name: "Aplicativo para garcom",
        description: "Interface responsiva para celular/tablet com lancamento operacional.",
        status: "operando",
        path: "/painel-dono/mesas"
      },
      {
        name: "Cupom de desconto",
        description: "Motor promocional para regras, validade e aplicacao no pedido.",
        status: "proximo"
      },
      {
        name: "Relatorios de clientes",
        description: "Cadastro e visao de clientes, origem, visitas, ticket e status.",
        status: "operando",
        path: "/painel-dono/clientes"
      },
      {
        name: "Pagamento online",
        description: "Cobranca online automatica ja preparada para assinatura SaaS; pedidos do restaurante dependem do gateway escolhido.",
        status: "integracao",
        path: "/meu-gestor/carteira",
        dependsOn: "Asaas, Mercado Pago ou outro PSP"
      },
      {
        name: "Integracao iFood",
        description: "Entrada automatica de pedidos do iFood requer credenciais oficiais e homologacao.",
        status: "integracao",
        dependsOn: "Conta iFood + API"
      }
    ]
  },
  {
    name: "Plano Inovacao",
    subtitle: "Mais controle gerencial, estoque completo e atendimento via QR.",
    items: [
      {
        name: "Curva ABC",
        description: "Ranking gerencial de produtos e clientes por peso no faturamento.",
        status: "proximo",
        path: "/painel-dono/relatorios"
      },
      {
        name: "Pagamento presencial online",
        description: "Receber na mesa com link/QR de pagamento e baixa automatica.",
        status: "integracao",
        dependsOn: "Gateway de pagamento + webhook"
      },
      {
        name: "Gestao de estoque completo",
        description: "Entradas, ajustes, baixa por venda, estoque minimo e custo medio.",
        status: "operando",
        path: "/painel-dono/estoque"
      },
      {
        name: "Garcom digital via QR Code",
        description: "Cliente chama atendimento e pode interagir pela mesa via QR.",
        status: "operando",
        path: "/painel-dono/qrcodes"
      },
      {
        name: "Avaliacao dos clientes",
        description: "Coleta de nota/comentario pos-atendimento e relatorio de satisfacao.",
        status: "proximo",
        path: "/painel-dono/clientes"
      },
      {
        name: "Solicitacao de ajuda ao garcom",
        description: "Chamadas de mesa ficam pendentes no operacional e podem ser atendidas.",
        status: "operando",
        path: "/painel-dono/mesas"
      },
      {
        name: "Relatorios de CMV real / estimado",
        description: "Custo por ficha tecnica, insumos, estoque e margem por produto.",
        status: "operando",
        path: "/painel-dono/dre"
      },
      {
        name: "Gestao financeira completa",
        description: "Contas a pagar, receber, despesas, fluxo e resumo executivo.",
        status: "operando",
        path: "/painel-dono/financeiro"
      }
    ]
  },
  {
    name: "Plano Profissional",
    subtitle: "Automacao comercial, fiscal, KDS, CRM e leitura financeira mais forte.",
    items: [
      {
        name: "CRM",
        description: "Base de clientes, tags, origem, ticket medio e status comercial.",
        status: "operando",
        path: "/painel-dono/clientes"
      },
      {
        name: "NFC-e / NF-e ilimitadas",
        description: "Emissao fiscal exige certificado digital, credenciamento e provedor fiscal.",
        status: "integracao",
        dependsOn: "Certificado A1 + SEFAZ/provedor fiscal"
      },
      {
        name: "Automacao de WhatsApp",
        description: "Conexao WhatsApp, QR de sessao, respostas e pedidos pelo atendimento.",
        status: "configuravel",
        path: "/painel-dono/whatsapp"
      },
      {
        name: "Lista de aniversariantes",
        description: "Clientes ja possuem data de nascimento; falta campanha automatica por data.",
        status: "proximo",
        path: "/painel-dono/clientes"
      },
      {
        name: "Precificacao dinamica",
        description: "Regras de margem, horario, demanda e custo para sugestao de preco.",
        status: "proximo",
        path: "/painel-dono/produtos"
      },
      {
        name: "DRE automatizada",
        description: "DRE geral, por periodo e por produto com custo estimado.",
        status: "operando",
        path: "/painel-dono/dre"
      },
      {
        name: "Painel KDS",
        description: "Fila de cozinha/bar para acompanhar pedidos por status.",
        status: "operando",
        path: "/painel-dono/cozinha"
      },
      {
        name: "Modulo fiscal Simples Nacional",
        description: "Configuracao tributaria, CFOP/NCM/CSOSN e emissao dependem do provedor fiscal.",
        status: "integracao",
        dependsOn: "Contador + provedor fiscal"
      },
      {
        name: "Programa de cashback",
        description: "Carteira de pontos/credito para retorno do cliente.",
        status: "proximo",
        path: "/painel-dono/clientes"
      },
      {
        name: "Segmentacao de publicos",
        description: "Filtros por recorrencia, ticket, origem, aniversario e inatividade.",
        status: "proximo",
        path: "/painel-dono/clientes"
      },
      {
        name: "Grupo exclusivo no WhatsApp",
        description: "Canal de relacionamento com clientes VIP e campanhas.",
        status: "integracao",
        dependsOn: "WhatsApp conectado + politica de envio"
      },
      {
        name: "Takeat Club",
        description: "Clube de beneficios/assinatura do restaurante para clientes finais.",
        status: "proximo"
      }
    ]
  },
  {
    name: "Plano Enterprise",
    subtitle: "Escala, franquia, IA gerencial, campanhas e integracoes pesadas.",
    items: [
      {
        name: "Maquininha POS / TEF",
        description: "Integracao com adquirente e homologacao de TEF/POS.",
        status: "integracao",
        dependsOn: "Fornecedor TEF/POS"
      },
      {
        name: "IA com relatorio no WhatsApp",
        description: "Resumo automatico de vendas, estoque, CMV e alertas enviados ao dono.",
        status: "proximo",
        path: "/painel-dono/whatsapp"
      },
      {
        name: "Recuperacao de clientes",
        description: "Campanhas para clientes inativos com mensagem e oferta.",
        status: "proximo",
        path: "/painel-dono/clientes"
      },
      {
        name: "Multilojas / painel do franqueado",
        description: "Multi-bar ja existe; falta visao consolidada por rede/franqueado.",
        status: "configuravel",
        path: "/painel-dono/config"
      },
      {
        name: "Gerente de contas",
        description: "Rotina operacional de suporte, onboarding e acompanhamento do cliente SaaS.",
        status: "proximo",
        path: "/meu-gestor/carteira"
      },
      {
        name: "Treinamento individualizado",
        description: "Checklist guiado, videos e acompanhamento por perfil.",
        status: "proximo",
        path: "/painel-dono"
      },
      {
        name: "CRM campanhas em massa",
        description: "Envio segmentado para WhatsApp com regras anti-spam e opt-in.",
        status: "integracao",
        path: "/painel-dono/clientes",
        dependsOn: "WhatsApp/API oficial e consentimento"
      }
    ]
  }
];

const totals = plans.flatMap((plan) => plan.items).reduce(
  (acc, item) => {
    acc[item.status] += 1;
    return acc;
  },
  { operando: 0, configuravel: 0, integracao: 0, proximo: 0 } as Record<FeatureStatus, number>
);

function normalizePath(path?: string) {
  if (!path) return null;
  if (window.location.pathname.startsWith("/painel-dono")) return path;
  return path.replace("/painel-dono", "");
}

function FeatureCard({ item }: { item: FeatureItem }) {
  const meta = statusMeta[item.status];
  const path = normalizePath(item.path);

  return (
    <div className="flex min-h-[190px] flex-col justify-between rounded-[1.4rem] border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold">{item.name}</h3>
          <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${meta.tone} 18%, var(--color-surface-alt))`, color: "var(--color-text)" }}>
            {meta.label}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">{item.description}</p>
        {item.dependsOn ? <p className="mt-3 text-xs font-semibold" style={{ color: "var(--color-primary)" }}>Depende de: {item.dependsOn}</p> : null}
      </div>
      {path ? (
        <Link to={path} className={item.status === "integracao" || item.status === "proximo" ? "btn-secondary mt-4 text-center" : "btn-primary mt-4 text-center"}>
          {item.status === "operando" ? "Abrir funcao" : item.status === "configuravel" ? "Configurar" : "Ver caminho"}
        </Link>
      ) : (
        <div className="mt-4 rounded-xl px-4 py-2 text-center text-sm font-semibold surface-soft">Modulo mapeado</div>
      )}
    </div>
  );
}

export function FeatureCenterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de modulos"
        subtitle="Todas as funcoes dos planos mapeadas dentro do RTPG: o que ja opera, o que configura agora e o que depende de integracao externa."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm text-muted">Ja operando</p>
          <strong className="mt-2 block text-3xl">{totals.operando}</strong>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Pronto para configurar</p>
          <strong className="mt-2 block text-3xl">{totals.configuravel}</strong>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Dependem de API/contrato</p>
          <strong className="mt-2 block text-3xl">{totals.integracao}</strong>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Proximos modulos</p>
          <strong className="mt-2 block text-3xl">{totals.proximo}</strong>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-xl font-bold">Como usar esta tela</h2>
        <p className="text-sm text-muted">
          Esta tela coloca dentro do app todas as funcoes das imagens. Ela evita vender promessa solta: cada modulo aparece com status claro.
          Modulos como fiscal, TEF/POS, iFood e pagamento presencial automatico precisam de credenciais, homologacao ou contrato com fornecedor.
        </p>
      </section>

      {plans.map((plan) => (
        <section key={plan.name} className="space-y-4">
          <div className="flex flex-col gap-2 rounded-[1.8rem] p-5 surface-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--color-primary)" }}>Pacote de funcoes</p>
            <h2 className="text-2xl font-bold">{plan.name}</h2>
            <p className="text-sm text-muted">{plan.subtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plan.items.map((item) => (
              <FeatureCard key={`${plan.name}-${item.name}`} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
