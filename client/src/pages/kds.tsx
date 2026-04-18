import { PageHeader } from "../components/common";
import { ComingSoonList, ModuleShell } from "../components/module-shell";

export function KdsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Cozinha e Bar" subtitle="Estrutura operacional para KDS e acompanhamento de produção." />
      <ModuleShell eyebrow="KDS" title="Painel pronto para evolução operacional" description="A arquitetura visual já está preparada para receber pedidos por estação, tempo de preparo e atualização de status em tempo real.">
        <ComingSoonList items={[
          "Colunas por status: pendente, em preparo, pronto, entregue",
          "Filtros por estação: cozinha, bar, sobremesa",
          "Tempo de preparo por ticket",
          "Observações críticas por item",
          "Atualização rápida do status pelo operador"
        ]} />
      </ModuleShell>
    </div>
  );
}
