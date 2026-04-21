import { Link } from "react-router-dom";

export function TermsPage() {
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
        <h1 className="text-4xl font-black tracking-tight text-[#21170f]">Termos de Uso</h1>
        <p className="mt-2 text-sm text-stone-500">Ultima atualizacao: abril de 2026</p>

        <div className="mt-10 space-y-8 text-stone-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-black text-[#21170f]">1. Aceitacao dos Termos</h2>
            <p className="mt-3">
              Ao acessar ou utilizar o RTPG, voce concorda com estes Termos de Uso e com nossa
              Politica de Privacidade. Se voce nao concordar com qualquer parte destes termos,
              nao deve utilizar a plataforma. O uso continuado apos alteracoes constitui aceitacao das novas condicoes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">2. Descricao do Servico</h2>
            <p className="mt-3">
              O RTPG e uma plataforma SaaS (Software como Servico) de gestao para restaurantes, bares e
              estabelecimentos alimenticios, oferecendo funcionalidades de PDV, controle de estoque,
              financeiro, relatorios, gestao de equipe e atendimento. O servico e fornecido via internet,
              em regime de assinatura mensal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">3. Conta e Responsabilidades do Usuario</h2>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>Voce e responsavel pela seguranca das suas credenciais de acesso;</li>
              <li>E proibido compartilhar senhas ou ceder acesso a terceiros nao autorizados;</li>
              <li>Voce e responsavel por todas as acoes realizadas em sua conta;</li>
              <li>Caso suspeite de acesso nao autorizado, notifique-nos imediatamente;</li>
              <li>As informacoes fornecidas no cadastro devem ser verdadeiras e atualizadas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">4. Planos e Pagamentos</h2>
            <p className="mt-3">
              O RTPG opera em modelo de assinatura. As condicoes de cada plano (valor, recursos incluidos
              e ciclo de cobranca) sao apresentadas na pagina de planos e confirmadas no momento da contratacao.
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>Os pagamentos sao processados via PIX pelo gateway Asaas;</li>
              <li>O acesso pode ser suspenso em caso de inadimplencia apos o vencimento;</li>
              <li>O periodo de teste ("trial") tem duracao definida e nao requer pagamento antecipado;</li>
              <li>Nao ha reembolso por periodo nao utilizado dentro de um ciclo de cobranca ja pago;</li>
              <li>Reajustes de preco serao comunicados com pelo menos 30 dias de antecedencia.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">5. Uso Aceitavel</h2>
            <p className="mt-3">E expressamente proibido:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>Utilizar a plataforma para fins ilegais ou que violem direitos de terceiros;</li>
              <li>Tentar acessar dados de outros usuarios ou restaurantes;</li>
              <li>Realizar engenharia reversa, descompilar ou copiar o software;</li>
              <li>Sobrecarregar intencionalmente a infraestrutura do sistema (ataques DoS);</li>
              <li>Inserir dados falsos com o objetivo de prejudicar o funcionamento da plataforma;</li>
              <li>Revender ou sublicenciar o acesso a plataforma sem autorizacao expressa.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">6. Propriedade Intelectual</h2>
            <p className="mt-3">
              Todo o codigo-fonte, design, logotipos, textos e funcionalidades da plataforma RTPG sao
              propriedade de seus desenvolvedores e estao protegidos pelas leis de propriedade intelectual
              aplicaveis. O usuario nao adquire nenhum direito de propriedade sobre o software ao contratar
              o servico — apenas uma licenca limitada, intransferivel e revogavel de uso.
            </p>
            <p className="mt-3">
              Os dados inseridos pelo usuario (produtos, clientes, pedidos, etc.) permanecem de propriedade
              do usuario. Ele pode exporta-los a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">7. Disponibilidade e SLA</h2>
            <p className="mt-3">
              Nos comprometemos a manter a plataforma disponivel com o melhor esforco razoavel. Porem,
              nao garantimos disponibilidade ininterrupta. Manutencoes programadas serao comunicadas
              com antecedencia. Eventos fora do nosso controle (falhas de infraestrutura de terceiros,
              desastres naturais, etc.) nao geram direito a compensacao.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">8. Limitacao de Responsabilidade</h2>
            <p className="mt-3">
              Na maxima extensao permitida pela lei, o RTPG nao sera responsavel por danos indiretos,
              incidentais, especiais ou consequenciais, incluindo perda de receita, lucros cessantes ou
              dados, decorrentes do uso ou impossibilidade de uso da plataforma.
            </p>
            <p className="mt-3">
              Nossa responsabilidade total nao excede o valor pago pelo usuario nos ultimos 3 (tres) meses
              anteriores ao evento que originou o dano.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">9. Rescisao</h2>
            <p className="mt-3">
              Qualquer das partes pode encerrar a relacao contratual a qualquer momento:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>O usuario pode cancelar sua conta nas configuracoes da plataforma;</li>
              <li>Podemos suspender ou encerrar contas que violem estes Termos, com ou sem aviso previo;</li>
              <li>Apos o cancelamento, o usuario tem 30 dias para exportar seus dados antes da exclusao definitiva.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">10. Legislacao Aplicavel</h2>
            <p className="mt-3">
              Estes Termos sao regidos pelas leis da Republica Federativa do Brasil. Qualquer controversia
              sera submetida ao foro da comarca da sede do prestador do servico, com renancia expressa
              a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-[#21170f]">11. Contato</h2>
            <p className="mt-3">
              Para duvidas sobre estes Termos, entre em contato pelo suporte disponivel na plataforma
              ou pelo e-mail informado na area de configuracoes da sua conta.
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
