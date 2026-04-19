import { prisma } from "../lib/prisma";
import { getWhatsAppStatus } from "./whatsapp";

type AgentLifecycleStatus = "PRONTO" | "EM_ESTRUTURACAO" | "DEPENDENCIA_EXTERNA" | "FUTURO";

type AgentSummary = {
  id: "orquestrador" | "estoque" | "cardapio" | "pedidos" | "atendimento" | "financeiro" | "insights";
  name: string;
  status: AgentLifecycleStatus;
  objective: string;
  dataPoints: string[];
  dependencies: string[];
  nextAction: string;
};

type AgentCenterPayload = {
  architecture: {
    strategy: string;
    coreProduct: string[];
    integratedAgents: string[];
    optionalAutomations: string[];
    commercialReasoning: string[];
  };
  counts: {
    products: number;
    categories: number;
    supplies: number;
    recipeItems: number;
    openOrders: number;
    tables: number;
    expenses: number;
    receivables: number;
    payables: number;
    sales: number;
  };
  agents: AgentSummary[];
  recommendations: Array<{
    id: string;
    severity: "ALTA" | "MEDIA" | "BAIXA";
    title: string;
    description: string;
    actionLabel: string;
    actionPath: string;
    sourceAgent: AgentSummary["id"];
  }>;
};

function hasOperationalBase(counts: AgentCenterPayload["counts"]) {
  return counts.products > 0 && counts.tables > 0;
}

function buildAgents(counts: AgentCenterPayload["counts"], whatsappStatus: ReturnType<typeof getWhatsAppStatus>): AgentSummary[] {
  const inventoryReady = counts.supplies > 0 && counts.recipeItems > 0;
  const menuReady = counts.products > 0 && counts.categories > 0;
  const ordersReady = counts.tables > 0 && (counts.openOrders > 0 || counts.products > 0);
  const financeReady = counts.receivables > 0 || counts.payables > 0 || counts.expenses > 0 || counts.sales > 0;
  const insightsReady = counts.sales >= 5 || counts.openOrders >= 5;

  return [
    {
      id: "orquestrador",
      name: "Agente Orquestrador",
      status: ordersReady && financeReady ? "EM_ESTRUTURACAO" : "FUTURO",
      objective: "Receber eventos da operacao, decidir qual agente sugerir e consolidar respostas sem automatizar decisoes sensiveis.",
      dataPoints: ["pedidos", "whatsapp", "financeiro", "estoque"],
      dependencies: ["Dominio unificado de pedidos", "Camada de eventos internos"],
      nextAction: "Concluir os agentes de pedidos, financeiro e atendimento antes de ativar a orquestracao."
    },
    {
      id: "estoque",
      name: "Agente de Estoque",
      status: inventoryReady ? "PRONTO" : "EM_ESTRUTURACAO",
      objective: "Monitorar consumo por ficha tecnica, alertar reposicao e destacar desvios de estoque do restaurante.",
      dataPoints: ["insumos", "movimentacoes", "ficha tecnica", "vendas"],
      dependencies: ["Insumos cadastrados", "Ficha tecnica por produto"],
      nextAction: inventoryReady
        ? "Ativar alertas de estoque minimo e sugestao de compra a partir do consumo do dia."
        : "Completar o cadastro de insumos e vincular os produtos principais a sua ficha tecnica."
    },
    {
      id: "cardapio",
      name: "Agente de Cardapio",
      status: menuReady ? "PRONTO" : "EM_ESTRUTURACAO",
      objective: "Organizar catalogo, disponibilidade e estrutura comercial do cardapio com apoio ao cadastro.",
      dataPoints: ["categorias", "produtos", "precos", "status ativo"],
      dependencies: ["Categorias", "Produtos ativos"],
      nextAction: menuReady
        ? "Expandir para disponibilidade por turno, variacoes e adicionais."
        : "Concluir a estrutura de categorias e validar os produtos de maior giro."
    },
    {
      id: "pedidos",
      name: "Agente de Pedidos",
      status: ordersReady ? "PRONTO" : "EM_ESTRUTURACAO",
      objective: "Centralizar pedidos de mesa, balcao e canais digitais usando Order como entidade principal.",
      dataPoints: ["mesas", "orders", "order items", "status operacional"],
      dependencies: ["Mesas", "Cardapio", "Fechamento de conta"],
      nextAction: ordersReady
        ? "Expandir para preparo, entrega e fila unica entre salao e WhatsApp."
        : "Garantir que toda mesa aberta gere um Order e que todos os itens entrem como OrderItem."
    },
    {
      id: "atendimento",
      name: "Agente de Atendimento",
      status: whatsappStatus.status === "CONECTADO" ? "PRONTO" : "DEPENDENCIA_EXTERNA",
      objective: "Atender no WhatsApp com linguagem mais humana, criar pedidos e encaminhar excecoes para humano.",
      dataPoints: ["mensagens", "qr code", "status do whatsapp", "pedidos do canal whatsapp"],
      dependencies: ["Baileys", "Sessao por restaurante", "Pedido unificado"],
      nextAction: whatsappStatus.status === "CONECTADO"
        ? "Refinar o fluxo de mensagens, handoff e confirmacoes antes de automatizar mais etapas."
        : "Estabilizar a conexao QR por restaurante e manter reconexao automatica com sessao persistida."
    },
    {
      id: "financeiro",
      name: "Agente Financeiro",
      status: financeReady ? "PRONTO" : "EM_ESTRUTURACAO",
      objective: "Consolidar receitas, despesas, pagamentos e DRE com base relacional pronta para crescimento.",
      dataPoints: ["recebiveis", "pagaveis", "pagamentos", "despesas", "vendas"],
      dependencies: ["Receivable", "Payable", "PaymentRecord", "Expense"],
      nextAction: financeReady
        ? "Ampliar para fluxo de caixa projetado e alertas de margem por restaurante."
        : "Migrar de vez os lancamentos manuais remanescentes para as tabelas relacionais."
    },
    {
      id: "insights",
      name: "Agente de Insights",
      status: insightsReady ? "EM_ESTRUTURACAO" : "FUTURO",
      objective: "Gerar leituras de venda, horarios de pico, produtos parados e resumos diarios automativos.",
      dataPoints: ["vendas", "itens vendidos", "despesas", "estoque"],
      dependencies: ["Historico de vendas consistente", "Financeiro relacional"],
      nextAction: insightsReady
        ? "Criar snapshots diarios e destacar oportunidades de margem e giro."
        : "Acumular historico operacional suficiente antes de ativar insights automaticos."
    }
  ];
}

export async function getAgentCenter(barId: string): Promise<AgentCenterPayload> {
  const [
    products,
    categories,
    supplies,
    recipeItems,
    openOrders,
    tables,
    expenses,
    receivables,
    payables,
    sales,
    lowStockSupplies,
    overdueReceivables,
    overduePayables,
    productsWithoutRecipe,
    stalledOrders
  ] = await Promise.all([
    prisma.product.count({ where: { barId, active: true } }),
    prisma.productCategory.count({ where: { barId } }),
    prisma.supply.count({ where: { barId, active: true } }),
    prisma.productRecipe.count({ where: { product: { barId } } }),
    prisma.order.count({ where: { barId, status: { in: ["ABERTO", "CONFIRMADO", "EM_PREPARO", "PRONTO", "ENTREGUE", "AGUARDANDO_PAGAMENTO"] } } }),
    prisma.restaurantTable.count({ where: { barId } }),
    prisma.expense.count({ where: { barId } }),
    prisma.receivable.count({ where: { barId } }),
    prisma.payable.count({ where: { barId } }),
    prisma.sale.count({ where: { barId } }),
    prisma.supply.findMany({
      where: {
        barId,
        active: true
      },
      select: {
        id: true,
        name: true,
        stockCurrent: true,
        stockMinimum: true
      },
      orderBy: [{ stockCurrent: "asc" }, { name: "asc" }]
    }),
    prisma.receivable.count({
      where: {
        barId,
        status: { in: ["PENDENTE", "PARCIAL", "VENCIDO"] },
        dueDate: { lt: new Date() }
      }
    }),
    prisma.payable.count({
      where: {
        barId,
        status: { in: ["PENDENTE", "PARCIAL", "VENCIDO"] },
        dueDate: { lt: new Date() }
      }
    }),
    prisma.product.count({
      where: {
        barId,
        active: true,
        recipeItems: { none: {} }
      }
    }),
    prisma.order.count({
      where: {
        barId,
        status: { in: ["CONFIRMADO", "EM_PREPARO", "PRONTO", "ENTREGUE", "AGUARDANDO_PAGAMENTO"] },
        openedAt: { lt: new Date(Date.now() - 20 * 60 * 1000) }
      }
    })
  ]);

  const counts = { products, categories, supplies, recipeItems, openOrders, tables, expenses, receivables, payables, sales };
  const whatsapp = getWhatsAppStatus(barId);
  const recommendations: AgentCenterPayload["recommendations"] = [];
  const lowStock = lowStockSupplies.filter((item) => Number(item.stockCurrent) <= Number(item.stockMinimum)).slice(0, 5);

  if (!whatsapp.phoneNumber || whatsapp.status !== "CONECTADO") {
    recommendations.push({
      id: "whatsapp-connect",
      severity: "ALTA",
      title: "Conectar o WhatsApp do restaurante",
      description: "O atendimento automatizado e os pedidos por mensagem dependem da conexao ativa do WhatsApp Business deste restaurante.",
      actionLabel: "Abrir WhatsApp e IA",
      actionPath: "/painel-dono/whatsapp",
      sourceAgent: "atendimento"
    });
  }

  if (lowStock.length > 0) {
    recommendations.push({
      id: "stock-alert",
      severity: "ALTA",
      title: "Insumos no limite minimo",
      description: `${lowStock.length} insumo(s) ja estao no nivel minimo ou abaixo dele. Isso impacta diretamente a operacao e a venda.`,
      actionLabel: "Ver estoque",
      actionPath: "/painel-dono/estoque",
      sourceAgent: "estoque"
    });
  }

  if (productsWithoutRecipe > 0) {
    recommendations.push({
      id: "recipe-missing",
      severity: "MEDIA",
      title: "Produtos sem ficha tecnica",
      description: `${productsWithoutRecipe} produto(s) ativos ainda nao possuem insumos vinculados. Sem isso, o custo e a baixa de estoque ficam incompletos.`,
      actionLabel: "Revisar cardapio",
      actionPath: "/painel-dono/produtos",
      sourceAgent: "cardapio"
    });
  }

  if (stalledOrders > 0) {
    recommendations.push({
      id: "orders-stalled",
      severity: "MEDIA",
      title: "Pedidos abertos ha muito tempo",
      description: `${stalledOrders} pedido(s) seguem abertos ha mais de 20 minutos. Vale revisar status e fechamento para nao perder controle operacional.`,
      actionLabel: "Abrir mesas e vendas",
      actionPath: "/painel-dono/mesas",
      sourceAgent: "pedidos"
    });
  }

  if (overdueReceivables > 0 || overduePayables > 0) {
    recommendations.push({
      id: "finance-overdue",
      severity: "ALTA",
      title: "Titulos financeiros vencidos",
      description: `Existem ${overdueReceivables} recebivel(eis) e ${overduePayables} pagavel(eis) vencidos. Isso precisa entrar na rotina financeira do restaurante.`,
      actionLabel: "Abrir financeiro",
      actionPath: "/painel-dono/financeiro",
      sourceAgent: "financeiro"
    });
  }

  if (!hasOperationalBase(counts)) {
    recommendations.push({
      id: "core-missing",
      severity: "ALTA",
      title: "Base operacional incompleta",
      description: "Antes de vender a operacao completa, o restaurante precisa ter mesas e cardapio ativos no proprio sistema.",
      actionLabel: "Revisar configuracao",
      actionPath: "/painel-dono/config",
      sourceAgent: "orquestrador"
    });
  }

  return {
    architecture: {
      strategy: "Core proprio de restaurante com agentes integrados no backend; automacoes externas entram depois, como apoio, e nao como base do produto.",
      coreProduct: [
        "Pedidos, mesas, cardapio, insumos, estoque, financeiro e DRE no proprio app",
        "Isolamento por barId em todos os modulos novos",
        "Decisoes de dinheiro e cancelamento continuam com confirmacao humana"
      ],
      integratedAgents: [
        "Pedido e operacao como entidade central",
        "Estoque ligado a ficha tecnica e consumo real",
        "Financeiro relacional para DRE e fluxo de caixa",
        "Atendimento no WhatsApp conectado ao dominio de pedido"
      ],
      optionalAutomations: [
        "n8n ou similar apenas para alertas, notificacoes, cobranças e integrações auxiliares",
        "Resumos diarios por WhatsApp, Telegram ou email",
        "Fluxos de suporte e follow-up comercial fora do core operacional"
      ],
      commercialReasoning: [
        "O produto fica vendavel porque o coracao do negocio nao depende de ferramenta externa",
        "Cada restaurante opera no proprio contexto, sem misturar dados",
        "A IA entra para acelerar atendimento e decisao, nao para segurar a operacao sozinha"
      ]
    },
    counts,
    agents: buildAgents(counts, whatsapp),
    recommendations
  };
}

export function getCommercialPlatformPositioning() {
  return {
    title: "Plataforma comercial recomendada",
    summary: "Sistema proprio como nucleo operacional, agentes integrados ao backend e automacoes externas apenas como apoio.",
    pillars: [
      "Core transacional proprio",
      "Agentes especializados por dominio",
      "WhatsApp isolado por restaurante",
      "Confirmacao humana em dinheiro e cancelamento"
    ]
  };
}
