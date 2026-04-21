import { Link } from "react-router-dom";

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#fffaf2]">
      <header className="border-b border-[#e3d4bf] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link to="/login" className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-[0.24em] text-[#8f5f31]">RTPG</span>
          </Link>
          <Link to="/login" className="text-sm font-bold text-[#8f5f31] hover:underline">Voltar ao inicio</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
        <h1 className="text-4xl font-black tracking-tight text-[#21170f]">Politica de Privacidade</h1>
        <p className="mt-2 text-sm text-stone-500">Ultima atualizacao: abril de 2026</p>

        <div className="mt-10 space-y-8 text-stone-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-black text-[#21170f]">1. Quem somos</h2>
            <p className="mt-3">
              O RTPG e uma plataforma de gestao para restaurantes operada por seus proprietarios. Esta Politica de Privacidade
              descreve como coletamos, usamos e protegemos seus dados pessoais, em conformidade com a
              Lei Geral de Protecao de Dados Pessoais (LGPD — Lei no 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">2. Dados que coletamos</h2>
            <p className="mt-3">Coletamos os seguintes dados pessoais para prestacao do servico:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone e razao social do estabelecimento.</li>
              <li><strong>Dados de acesso:</strong> login, senha criptografada e historico de sessoes.</li>
              <li><strong>Dados operacionais:</strong> pedidos, produtos, insumos, clientes do restaurante e movimentacoes financeiras.</li>
              <li><strong>Dados de pagamento:</strong> informacoes de cobranca processadas pelo gateway Asaas (nao armazenamos dados de cartao).</li>
              <li><strong>Dados tecnicos:</strong> endereco IP, tipo de navegador e logs de acesso para seguranca e diagnostico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">3. Como usamos seus dados</h2>
            <p className="mt-3">Seus dados sao utilizados exclusivamente para:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>Prestacao e melhoria dos servicos do RTPG;</li>
              <li>Comunicacao sobre sua conta, pagamentos e atualizacoes do sistema;</li>
              <li>Prevencao de fraudes e garantia da seguranca da plataforma;</li>
              <li>Cumprimento de obrigacoes legais e regulatorias.</li>
            </ul>
            <p className="mt-3">Nao vendemos, alugamos ou compartilhamos seus dados com terceiros para fins comerciais.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">4. Base legal para o tratamento</h2>
            <p className="mt-3">O tratamento de dados pessoais e realizado com base nos seguintes fundamentos da LGPD:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li><strong>Execucao de contrato</strong> (art. 7o, V): para operacao da sua conta e prestacao do servico contratado.</li>
              <li><strong>Cumprimento de obrigacao legal</strong> (art. 7o, II): para atendimento de exigencias fiscais e regulatorias.</li>
              <li><strong>Interesses legitimos</strong> (art. 7o, IX): para seguranca, prevencao de fraudes e melhoria do servico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">5. Compartilhamento de dados</h2>
            <p className="mt-3">Podemos compartilhar dados com terceiros apenas nas seguintes situacoes:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li><strong>Processadores de pagamento (Asaas):</strong> para cobranca e confirmacao de pagamentos via PIX.</li>
              <li><strong>Provedores de infraestrutura (AWS):</strong> para hospedagem segura dos dados.</li>
              <li><strong>Autoridades publicas:</strong> quando exigido por lei ou ordem judicial.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">6. Retencao de dados</h2>
            <p className="mt-3">
              Mantemos seus dados pelo periodo necessario para a prestacao do servico e cumprimento de obrigacoes legais.
              Apos o encerramento da conta, os dados sao retidos por ate 5 (cinco) anos para fins fiscais e legais,
              conforme exigido pela legislacao brasileira, e entao excluidos de forma segura.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">7. Seus direitos (LGPD)</h2>
            <p className="mt-3">Voce tem os seguintes direitos em relacao aos seus dados pessoais:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>Confirmacao da existencia de tratamento e acesso aos dados;</li>
              <li>Correcao de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimizacao, bloqueio ou eliminacao de dados desnecessarios;</li>
              <li>Portabilidade dos dados a outro fornecedor de servico;</li>
              <li>Eliminacao dos dados tratados com base no consentimento;</li>
              <li>Informacao sobre terceiros com quem os dados sao compartilhados;</li>
              <li>Revogacao do consentimento a qualquer momento.</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos, entre em contato pelo e-mail informado na secao de suporte da plataforma.
              Respondemos em ate 15 dias uteis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">8. Seguranca dos dados</h2>
            <p className="mt-3">
              Adotamos medidas tecnicas e organizacionais adequadas para proteger seus dados, incluindo:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>Criptografia AES-256-GCM para dados sensiveis;</li>
              <li>Transporte via HTTPS com HSTS habilitado;</li>
              <li>Controle de acesso baseado em perfis (RBAC);</li>
              <li>Rate limiting e bloqueio de tentativas excessivas de login;</li>
              <li>Backups periodicos com retencao segura.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">9. Cookies e tecnologias semelhantes</h2>
            <p className="mt-3">
              Utilizamos cookies de sessao estritamente necessarios para autenticacao e funcionamento do sistema.
              Nao utilizamos cookies de rastreamento ou publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">10. Alteracoes nesta politica</h2>
            <p className="mt-3">
              Podemos atualizar esta Politica de Privacidade periodicamente. Notificaremos usuarios sobre mudancas
              relevantes por e-mail ou aviso na plataforma com pelo menos 15 dias de antecedencia.
              O uso continuado do servico apos a notificacao implica aceitacao das alteracoes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">11. Contato e Encarregado (DPO)</h2>
            <p className="mt-3">
              Para duvidas, solicitacoes ou reclamacoes sobre o tratamento de seus dados pessoais, entre em contato
              pelo painel de suporte da plataforma ou pelo e-mail disponivel na area de configuracoes da sua conta.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-[#e3d4bf] pt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-stone-500">
          <p>RTPG &copy; {new Date().getFullYear()} &mdash; Todos os direitos reservados</p>
          <div className="flex gap-4">
            <Link to="/privacidade" className="hover:text-[#8f5f31]">Privacidade</Link>
            <Link to="/termos" className="hover:text-[#8f5f31]">Termos de uso</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
