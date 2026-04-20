# RTPG Gestão

Primeira versão funcional de um sistema local para operação de bar/restaurante com:

- login por usuário
- perfis `administrador` e `operador`
- dashboard
- cadastro de produtos
- cadastro de insumos
- ficha técnica produto x insumos
- estoque, compras e ajustes
- operação por mesas
- fechamento de conta com baixa automática de estoque
- QR Code por mesa para chamar garçom
- DRE consolidada e por produto

Tudo foi estruturado para rodar localmente no Windows, com persistência real em `SQLite` e foco em uso offline/local.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Banco: SQLite
- ORM: Prisma

## Email transacional com Amazon SES

O backend envia email de boas-vindas por SMTP usando Amazon SES. As credenciais nunca ficam no codigo; configure no arquivo `.env` do ambiente:

```env
SES_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SES_SMTP_PORT=587
SES_SMTP_USER=
SES_SMTP_PASS=
SES_FROM_EMAIL=comercial@rtpgapp.com
SES_FROM_NAME=RTPG App
APP_BASE_URL=https://rtpgapp.com
```

Observacoes:

- `SES_SMTP_USER` e `SES_SMTP_PASS` sao as credenciais SMTP geradas no Amazon SES.
- O remetente `SES_FROM_EMAIL` precisa estar verificado no SES enquanto a conta estiver em sandbox.
- O envio de email roda em `try/catch`: se o SES falhar, o cadastro continua funcionando e o erro fica no log do servidor.
- Rota protegida para teste: `POST /admin/test-email` com `Authorization: Bearer <token-admin-plataforma>` e body `{ "email": "destino@exemplo.com" }`.

## Cobranca da mensalidade com Asaas

O RTPG separa dois fluxos de pagamento:

- Pagamento das mesas: dinheiro do restaurante, configurado pelo proprio restaurante em `Configuracoes > Pagamentos`.
- Mensalidade RTPG: dinheiro da plataforma, configurado no servidor com a conta Asaas do dono do RTPG.

Configure no `.env` do servidor:

```env
PLATFORM_ASAAS_API_KEY=
PLATFORM_ASAAS_SANDBOX=true
PLATFORM_ASAAS_WEBHOOK_TOKEN=
```

Como usar:

1. Cadastre ou selecione um restaurante em `Meu gestor > Carteira`.
2. Preencha o CPF/CNPJ do pagador. O Asaas exige CPF/CNPJ para criar o cliente de cobranca.
3. Clique em `Gerar Pix Asaas`.
4. Envie o QR Code ou copia-e-cola ao cliente.
5. Quando o Asaas confirmar o pagamento, o webhook atualiza a carteira automaticamente.

Webhook da plataforma:

```text
https://rtpgapp.com/api/billing/webhook/asaas
```

No painel Asaas, configure esse webhook com um token seguro e copie o mesmo valor para `PLATFORM_ASAAS_WEBHOOK_TOKEN`. O Asaas envia esse token no header `asaas-access-token`, e o RTPG valida esse header antes de processar o pagamento.

Eventos recomendados para cobrancas: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED` e `PAYMENT_REFUNDED`.

## Estrutura do projeto

```text
rtpg/
  client/           frontend React
  server/           backend Express
  prisma/           schema e seed
  scripts/          instalação, execução e resolução do diretório persistente
  storage/          banco SQLite gerado em tempo de execução
```

## Como a persistência funciona

O sistema sempre tenta usar uma pasta base chamada `rtpg` para guardar os dados locais.

Ordem de busca do diretório persistente:

1. Valor da variável `RTPG_DATA_DIR`, se configurada.
2. A própria pasta atual, se o nome dela for `rtpg`.
3. Uma subpasta `rtpg` dentro da pasta atual.
4. Pastas comuns do usuário:
   - `Google Drive\rtpg`
   - `Meu Drive\rtpg`
   - `My Drive\rtpg`
   - `OneDrive\rtpg`
   - `Documents\rtpg`
5. Se nada disso existir, o sistema cria `rtpg_local` na pasta do projeto.

O banco fica em:

```text
<pasta-base-rtpg>\storage\rtpg.sqlite
```

## Importante sobre o Google Drive

O link do Google Drive enviado por você não é, por si só, um caminho local do Windows. Para que a sincronização funcione, o projeto precisa estar dentro de uma pasta local sincronizada pelo aplicativo do Google Drive no computador.

Exemplo de caminho local ideal:

```text
C:\Users\SEU_USUARIO\Google Drive\rtpg
```

ou:

```text
C:\Users\SEU_USUARIO\Meu Drive\rtpg
```

Se o Google Drive estiver sincronizando essa pasta localmente, o banco e os arquivos persistentes também serão sincronizados.

## Pré-requisitos

Você pode usar uma destas opções:

1. Ter `Node.js 20+` instalado no Windows.
2. Ou usar a pasta local de Node já existente ao lado deste projeto:
   - `..\nodejs\node-v20.20.2-win-x64`

Os scripts PowerShell já tentam usar essa instalação local automaticamente.

## Instalação no Windows

Abra o PowerShell dentro da pasta do projeto e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\install.ps1
```

Esse script faz:

1. `npm install`
2. `prisma generate`
3. bootstrap do SQLite via migração SQL local versionada
4. `prisma db seed`

## Como rodar em desenvolvimento

```powershell
.\scripts\run.ps1
```

Ou, se o Node estiver no PATH:

```powershell
npm run dev
```

O frontend roda em:

- `http://localhost:5173`

O backend roda em:

- `http://localhost:3333`

## Usuário inicial

Após o seed inicial:

- usuário: `admin@rtpg.local`
- senha: `admin123`

## Fluxo recomendado de uso

1. Entrar com o usuário administrador.
2. Criar ou ajustar usuários.
3. Cadastrar produtos vendidos.
4. Cadastrar insumos.
5. Montar a ficha técnica.
6. Lançar compras e estoque.
7. Abrir mesas e registrar itens.
8. Fechar a conta para gerar venda e baixar estoque.
9. Consultar QR Codes e DRE.

## Scripts disponíveis

- `npm run dev`: sobe frontend e backend em modo desenvolvimento.
- `npm run build`: valida TypeScript e gera build do frontend.
- `npm run start`: sobe o backend via `tsx`.
- `npm run db:generate`: gera o Prisma Client.
- `npm run db:push`: aplica o bootstrap do SQLite usando a migração local `prisma/migrations/0001_init/migration.sql`.
- `npm run db:seed`: popula usuário admin, mesas e dados iniciais.

## Funcionalidades entregues nesta primeira versão

### Autenticação e usuários

- login por e-mail e senha
- cadastro de usuário
- sessão persistente em `localStorage`
- RBAC com `ADMIN` e `OPERADOR`
- listagem, edição e exclusão de usuários por administrador

### Produtos

- cadastro
- listagem
- busca
- exclusão
- edição simples
- preço de venda e categoria

### Insumos

- cadastro
- listagem
- busca
- exclusão
- edição simples
- custo médio, estoque atual e estoque mínimo

### Ficha técnica

- relacionamento produto x insumos
- quantidade usada por unidade vendida
- custo estimado do produto

### Estoque

- lançamentos de compra
- cálculo de custo unitário
- recálculo de custo médio
- histórico de entradas
- ajustes manuais
- movimentações de estoque

### Operação por mesas

- lista de mesas
- abertura automática de sessão
- adição e remoção de itens
- subtotal
- status da mesa
- fechamento de conta
- geração de venda
- baixa automática de estoque
- bloqueio quando falta estoque

### QR Code por mesa

- QR Code único por mesa
- tela pública simples
- botão de chamar garçom
- lista de chamados pendentes

### Relatórios e DRE

- cards-resumo
- DRE consolidada
- DRE por produto
- cadastro de categorias de despesas
- lançamento de despesas operacionais
- gráfico simples com `recharts`

## Backup

O backup principal é a própria pasta base `rtpg`, especialmente:

```text
storage\rtpg.sqlite
```

Para backup manual:

1. Feche o sistema.
2. Copie a pasta `storage`.
3. Guarde em outro local.

Se a pasta `rtpg` estiver sincronizada pelo Google Drive, esse banco já terá sincronização automática como primeira camada de segurança.

## Observações importantes

- Esta primeira versão foi desenhada para uma única operação com múltiplos usuários.
- A base já está preparada para evoluir para multiunidade/multiempresa depois.
- Campos monetários e datas foram feitos em português do Brasil.
- O cadastro público de usuário existe para simplificar a primeira versão local. Em ambiente de produção, o ideal é deixar esse cadastro restrito ao administrador.

## Próximas melhorias sugeridas

1. Restringir o cadastro público e mover toda criação de usuários para fluxo 100% administrativo.
2. Adicionar edição completa em modais e formulários mais avançados.
3. Criar mapa visual de salão com posicionamento real das mesas.
4. Permitir múltiplos pedidos simultâneos por mesa com impressão de comandas.
5. Adicionar meios de pagamento, sangrias, caixa e fechamento de turno.
6. Incluir relatórios exportáveis em PDF e Excel.
7. Adicionar auditoria mais detalhada de ações críticas.
8. Implementar multiempresa e separação total por unidade.
9. Melhorar o fluxo do QR Code para cardápio e autosserviço.
10. Criar instalador desktop ou execução via serviço local para subir automaticamente com o Windows.
