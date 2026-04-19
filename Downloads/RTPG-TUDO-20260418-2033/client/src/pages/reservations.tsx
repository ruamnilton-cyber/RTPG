import { PageHeader } from "../components/common";
import { ComingSoonList, ModuleShell } from "../components/module-shell";

export function ReservationsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Reservas" subtitle="Estrutura pronta para agenda de mesas, horários e status de confirmação." />
      <ModuleShell eyebrow="Reservas" title="Base de reservas preparada" description="O módulo foi desenhado para encaixar agenda de salão e ligação com mesas, setores e capacidade futura.">
        <ComingSoonList items={[
          "Cliente, telefone, data e hora",
          "Quantidade de pessoas e setor",
          "Status: pendente, confirmada, cancelada, concluída",
          "Vínculo com mesa e capacidade",
          "Pronto para integração com CRM"
        ]} />
      </ModuleShell>
    </div>
  );
}
