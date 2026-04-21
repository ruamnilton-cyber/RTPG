import { Link } from "react-router-dom";

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-background)" }}>
      <header className="border-b px-5 py-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-sm font-bold" style={{ color: "var(--color-foreground)" }}>RTPG</span>
          <Link to="/login" className="text-sm text-muted hover:underline">Voltar</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 lg:px-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-foreground)" }}>Politica de Privacidade</h1>
        <p className="mt-1 text-sm text-muted">Ultima atualizacao: abril de 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7" style={{ color: "var(--color-foreground)" }}>

          <section>
            <h2 className="text-base font-bold">1. Quem somos</h2>
            <p className="mt-2 text-muted">
              O RTPG e uma plataforma de gestao para restaurantes. Esta Politica descreve como coletamos,
              usamos e protegemos seus dados pessoais, em conformidade com a LGPD (Lei no 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">2. Dados que coletamos</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li><strong className="text-inherit">Cadastro:</strong> nome, e-mail, telefone e razao social.</li>
              <li><strong className="text-inherit">Acesso:</strong> login, senha criptografada e historico de sessoes.</li>
              <li><strong className="text-inherit">Operacao:</strong> pedidos, produtos, insumos, clientes e financeiro do restaurante.</li>
              <li><strong className="text-inherit">Pagamento:</strong> dados processados pelo gateway Asaas (nao armazenamos cartoes).</li>
              <li><strong className="text-inherit">Tecnicos:</strong> IP, navegador e logs de acesso para seguranca.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold">3. Como usamos seus dados</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li>Prestacao e melhoria dos servicos do RTPG;</li>
              <li>Comunicacao sobre conta, pagamentos e atualizacoes;</li>
              <li>Prevencao de fraudes e seguranca da plataforma;</li>
              <li>Cumprimento de obrigacoes legais.</li>
            </ul>
            <p className="mt-2 text-muted">Nao vendemos nem compartilhamos seus dados com terceiros para fins comerciais.</p>
          </section>

          <section>
            <h2 className="text-base font-bold">4. Base legal</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li><strong className="text-inherit">Execucao de contrato</strong> (art. 7o, V): para operar sua conta e prestar o servico.</li>
              <li><strong className="text-inherit">Obrigacao legal</strong> (art. 7o, II): para exigencias fiscais e regulatorias.</li>
              <li><strong className="text-inherit">Interesse legitimo</strong> (art. 7o, IX): para seguranca e melhoria do servico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold">5. Compartilhamento</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li><strong className="text-inherit">Asaas:</strong> gateway de pagamento para cobrancas via PIX.</li>
              <li><strong className="text-inherit">AWS:</strong> hospedagem da infraestrutura.</li>
              <li><strong className="text-inherit">Autoridades:</strong> quando exigido por lei ou ordem judicial.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold">6. Retencao</h2>
            <p className="mt-2 text-muted">
              Dados sao mantidos pelo periodo necessario para o servico e obrigacoes legais.
              Apos cancelamento da conta, retemos por ate 5 anos para fins fiscais e depois excluimos de forma segura.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">7. Seus direitos (LGPD)</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li>Acesso e confirmacao do tratamento dos seus dados;</li>
              <li>Correcao de dados incompletos ou incorretos;</li>
              <li>Eliminacao de dados desnecessarios;</li>
              <li>Portabilidade para outro fornecedor;</li>
              <li>Informacao sobre terceiros com quem compartilhamos;</li>
              <li>Revogacao do consentimento a qualquer momento.</li>
            </ul>
            <p className="mt-2 text-muted">Respondemos solicitacoes em ate 15 dias uteis pelo suporte da plataforma.</p>
          </section>

          <section>
            <h2 className="text-base font-bold">8. Seguranca</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted">
              <li>Criptografia AES-256-GCM para dados sensiveis;</li>
              <li>Transporte via HTTPS com HSTS;</li>
              <li>Controle de acesso por perfis (RBAC);</li>
              <li>Rate limiting em login e billing;</li>
              <li>Backups periodicos com retencao segura.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold">9. Cookies</h2>
            <p className="mt-2 text-muted">
              Usamos apenas cookies de sessao estritamente necessarios para autenticacao.
              Nenhum cookie de rastreamento ou publicidade e utilizado.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">10. Alteracoes</h2>
            <p className="mt-2 text-muted">
              Notificaremos mudancas relevantes por e-mail ou aviso na plataforma com pelo menos 15 dias de antecedencia.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold">11. Contato</h2>
            <p className="mt-2 text-muted">
              Duvidas ou solicitacoes: use o suporte disponivel dentro da plataforma ou o e-mail nas configuracoes da conta.
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
