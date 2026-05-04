import { Link } from "react-router-dom";

const UPDATED_AT = "22 de abril de 2026";
const PROVIDER = "RTPG Gestão";
const CONTACT_EMAIL = "contato@rtpg.com.br";
const CONTACT_WHATSAPP = "(XX) 9XXXX-XXXX";

export function TermsPage() {
  return (
    <div className="min-h-screen bg-stone-100 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">

        <div className="rounded-[2rem] bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">
            {PROVIDER}
          </p>
          <h1 className="mt-3 text-3xl font-bold">Termos de Uso e Contrato de Serviço</h1>
          <p className="mt-2 text-sm text-gray-500">Última atualização: {UPDATED_AT}</p>
        </div>

        <Section title="1. Das Partes">
          <p>
            O presente contrato é firmado entre <strong>{PROVIDER}</strong> ("Fornecedor"), responsável pelo
            desenvolvimento e disponibilização do sistema de gestão para bares e restaurantes, e a pessoa
            física ou jurídica que efetua o cadastro na plataforma ("Cliente").
          </p>
          <p className="mt-3">
            Ao solicitar acesso, o Cliente declara ter lido, compreendido e aceito integralmente os termos
            aqui descritos.
          </p>
        </Section>

        <Section title="2. Objeto do Contrato">
          <p>
            O Fornecedor concede ao Cliente acesso ao sistema RTPG Gestão — plataforma SaaS de gestão
            para bares e restaurantes — incluindo módulos de mesas, comandas, cardápio, estoque,
            financeiro e relatórios, conforme o plano contratado.
          </p>
          <p className="mt-3">
            O acesso é não exclusivo, intransferível e restrito ao estabelecimento cadastrado pelo
            Cliente no ato da contratação.
          </p>
        </Section>

        <Section title="3. Planos e Mensalidade">
          <p>
            O sistema é disponibilizado em planos mensais com valores, funcionalidades e limites de
            usuários definidos na proposta apresentada pelo Fornecedor. O Cliente concorda com o valor
            mensal estipulado no momento da contratação.
          </p>
          <ul className="mt-3 list-disc pl-5 space-y-1 text-sm">
            <li>O vencimento é combinado entre as partes no ato do cadastro.</li>
            <li>O pagamento é realizado via Pix ou boleto, conforme orientação do Fornecedor.</li>
            <li>A falta de pagamento por mais de 5 dias corridos após o vencimento pode resultar em suspensão do acesso.</li>
            <li>O desbloqueio ocorre em até 24 horas após a confirmação do pagamento.</li>
          </ul>
        </Section>

        <Section title="4. Prazo e Rescisão">
          <p>
            O contrato é de prazo indeterminado, podendo ser rescindido por qualquer das partes com
            aviso prévio de <strong>15 (quinze) dias corridos</strong>.
          </p>
          <p className="mt-3">
            O Fornecedor pode rescindir imediatamente em caso de: uso indevido da plataforma, violação
            destes termos, inadimplência superior a 30 dias ou qualquer ato que cause dano ao sistema
            ou a outros usuários.
          </p>
          <p className="mt-3">
            Não há cobrança de multa rescisória quando respeitado o prazo de aviso prévio.
          </p>
        </Section>

        <Section title="5. Responsabilidades do Cliente">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Manter os dados de acesso (login e senha) em sigilo.</li>
            <li>Não compartilhar o acesso com outros estabelecimentos não contratantes.</li>
            <li>Manter seus dados cadastrais atualizados.</li>
            <li>Usar o sistema exclusivamente para fins lícitos relacionados à gestão do estabelecimento.</li>
            <li>Realizar backups adicionais dos dados críticos quando necessário.</li>
          </ul>
        </Section>

        <Section title="6. Responsabilidades do Fornecedor">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Manter o sistema disponível com esforço razoável de uptime (meta: 99%).</li>
            <li>Notificar o Cliente com antecedência em caso de manutenções programadas.</li>
            <li>Não compartilhar dados do Cliente com terceiros sem autorização, salvo obrigação legal.</li>
            <li>Fornecer suporte técnico dentro do horário combinado.</li>
          </ul>
          <p className="mt-3">
            O Fornecedor não se responsabiliza por perdas decorrentes de uso incorreto do sistema,
            falhas de internet no estabelecimento do Cliente ou integração com serviços de terceiros
            (Mercado Pago, Asaas, WhatsApp).
          </p>
        </Section>

        <Section title="7. Dados e Privacidade">
          <p>
            Os dados inseridos pelo Cliente no sistema são de propriedade do Cliente. O Fornecedor
            processa esses dados exclusivamente para prestação do serviço contratado, em conformidade
            com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
          <p className="mt-3">
            Em caso de rescisão, o Cliente pode solicitar exportação dos seus dados em até 30 dias
            após o encerramento do acesso.
          </p>
        </Section>

        <Section title="8. Atualizações do Sistema e dos Termos">
          <p>
            O Fornecedor pode atualizar o sistema e estes termos a qualquer momento. Alterações
            relevantes serão comunicadas com antecedência mínima de 15 dias pelo canal de contato
            cadastrado.
          </p>
          <p className="mt-3">
            O uso continuado do sistema após a notificação implica aceite das novas condições.
          </p>
        </Section>

        <Section title="9. Foro e Legislação">
          <p>
            Este contrato é regido pelas leis brasileiras. Eventuais conflitos serão resolvidos de
            preferência por negociação direta e, caso necessário, submetidos ao foro da comarca do
            domicílio do Fornecedor.
          </p>
        </Section>

        <Section title="10. Contato">
          <p>Para dúvidas, suporte ou notificações contratuais:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
            <li>E-mail: <strong>{CONTACT_EMAIL}</strong></li>
            <li>WhatsApp: <strong>{CONTACT_WHATSAPP}</strong></li>
          </ul>
        </Section>

        <div className="rounded-[2rem] bg-white p-8 shadow-sm text-center">
          <p className="text-sm text-gray-500">
            Ao solicitar acesso ao sistema, o Cliente confirma que leu e concorda com estes termos.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-2xl bg-amber-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-800"
          >
            Voltar ao login
          </Link>
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] bg-white p-8 shadow-sm space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm leading-relaxed text-gray-700">{children}</div>
    </div>
  );
}
