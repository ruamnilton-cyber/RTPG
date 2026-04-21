import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-background)" }}>
      <header className="border-b px-5 py-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-sm font-bold" style={{ color: "var(--color-foreground)" }}>RTPG</span>
          <Link to="/login" className="text-sm text-muted hover:underline">Voltar</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 lg:px-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-foreground)" }}>Termos de Uso</h1>
        <p className="mt-1 text-sm text-muted">Ultima atualizacao: abril de 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7" style={{ color: "var(--color-foreground)" }}>

          <section>
            <h2 className="text-base font-bold">1. Aceitacao</h2>
            <p className="mt-2 text-muted">
              Ao usar o RTPG, voce concorda com estes Termos e com nossa Politica de Privacidade.
              O uso continuado apos alteracoes constitui aceitacao das novas condicoes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">2. O servico</h2>
            <p className="mt-2 text-muted">
              O RTPG e uma plataforma SaaS de gestao para restaurantes — PDV, estoque, financeiro,
              relatorios e equipe — fornecida via internet em regime de assinatura mensal.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">3. Sua conta</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li>Voce e responsavel pela seguranca das suas credenciais;</li>
              <li>E proibido compartilhar acesso com terceiros nao autorizados;</li>
              <li>Todas as acoes realizadas na conta sao de sua responsabilidade;</li>
              <li>Informe-nos imediatamente em caso de acesso nao autorizado.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold">4. Planos e pagamentos</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li>Pagamentos via PIX processados pelo gateway Asaas;</li>
              <li>Acesso pode ser suspenso em caso de inadimplencia apos o vencimento;</li>
              <li>O periodo de trial nao requer pagamento antecipado;</li>
              <li>Nao ha reembolso por periodo nao utilizado dentro de um ciclo ja pago;</li>
              <li>Reajustes comunicados com pelo menos 30 dias de antecedencia.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold">5. Uso aceitavel</h2>
            <p className="mt-2 text-muted">E proibido:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li>Usar a plataforma para fins ilegais ou que violem direitos de terceiros;</li>
              <li>Tentar acessar dados de outros usuarios ou restaurantes;</li>
              <li>Realizar engenharia reversa ou copiar o software;</li>
              <li>Sobrecarregar intencionalmente a infraestrutura (DoS);</li>
              <li>Revender acesso sem autorizacao expressa.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold">6. Propriedade intelectual</h2>
            <p className="mt-2 text-muted">
              Codigo, design e funcionalidades do RTPG sao propriedade de seus desenvolvedores.
              O usuario recebe apenas uma licenca limitada e intransferivel de uso.
              Os dados inseridos pelo usuario (produtos, clientes, pedidos) pertencem a ele e podem ser exportados a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">7. Disponibilidade</h2>
            <p className="mt-2 text-muted">
              Mantemos a plataforma disponivel com o melhor esforco razoavel. Manutencoes programadas
              sao comunicadas com antecedencia. Eventos fora do nosso controle nao geram direito a compensacao.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">8. Limitacao de responsabilidade</h2>
            <p className="mt-2 text-muted">
              Nao nos responsabilizamos por danos indiretos ou lucros cessantes decorrentes do uso da plataforma.
              Nossa responsabilidade total nao excede o valor pago nos ultimos 3 meses anteriores ao evento.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">9. Cancelamento</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li>Voce pode cancelar sua conta nas configuracoes a qualquer momento;</li>
              <li>Contas que violem estes Termos podem ser suspensas sem aviso previo;</li>
              <li>Apos cancelamento, voce tem 30 dias para exportar seus dados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold">10. Lei aplicavel</h2>
            <p className="mt-2 text-muted">
              Estes Termos sao regidos pelas leis do Brasil. Qualquer controversia sera submetida
              ao foro da comarca da sede do prestador do servico.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">11. Contato</h2>
            <p className="mt-2 text-muted">
              Duvidas sobre estes Termos: suporte disponivel dentro da plataforma ou e-mail nas configuracoes da conta.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted" style={{ borderColor: "var(--color-border)" }}>
          <span>RTPG &copy; {new Date().getFullYear()}</span>
          <div className="flex gap-4">
            <Link to="/privacidade" className="hover:underline">Privacidade</Link>
            <Link to="/termos" className="hover:underline">Termos de uso</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
