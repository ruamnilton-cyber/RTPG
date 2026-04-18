import { PageHeader } from "../components/common";
import { ComingSoonList, ModuleShell } from "../components/module-shell";

export function ReportsCenterPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Central de relatorios" subtitle="Ponto unico para relatorios operacionais, gerenciais, caixa, margem e evolucao do produto." />
      <ModuleShell
        eyebrow="Relatorios"
        title="Arquitetura preparada para exportacao e filtros"
        description="A central passa a conversar com a nova base de organizacao, financeiro e IA, deixando o sistema pronto para visoes por canal, unidade e rentabilidade."
      >
        <ComingSoonList items={[
          "Vendas por periodo, produto, categoria, mesa e garcom",
          "Pedidos cancelados e tempo medio de preparo",
          "Movimentacao de estoque e ruptura",
          "Despesas por categoria, centro de custo e unidade",
          "Fechamento de caixa, fluxo de caixa e DRE detalhada",
          "Comparativo entre canais, unidades e performance da IA"
        ]} />
      </ModuleShell>
    </div>
  );
}
