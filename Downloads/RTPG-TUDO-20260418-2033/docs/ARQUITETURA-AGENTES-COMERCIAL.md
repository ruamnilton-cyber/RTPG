# Arquitetura Comercial Recomendada

## Decisao principal

Para comercializar o produto com restaurantes, o nucleo da operacao deve ficar no proprio sistema:

- pedidos
- mesas e comandas
- cardapio
- insumos e ficha tecnica
- estoque
- financeiro
- DRE
- autenticacao e isolamento por restaurante

Os agentes de IA devem ser integrados ao backend da plataforma, usando os dados reais do restaurante, e nao apoiados em automacoes externas como base do produto.

## Onde n8n entra

`n8n` ou ferramenta semelhante pode ser usada depois, como camada auxiliar, para:

- alertas
- notificacoes
- follow-up comercial
- cobranças
- resumos diarios
- integrações administrativas

Nao deve ser o motor principal do sistema.

## Estrutura recomendada

### 1. Core do Restaurante

- `Order` como entidade central
- fluxo de mesas e comandas
- vendas e pagamentos
- estoque ligado a ficha tecnica
- despesas e DRE

### 2. Agentes Integrados

- Agente de Cardapio
- Agente de Estoque
- Agente de Pedidos
- Agente Financeiro
- Agente de Atendimento
- Agente de Insights
- Agente Orquestrador

### 3. Servico de WhatsApp

- sessao por restaurante
- QR Code por restaurante
- reconexao automatica
- pedidos do canal `WHATSAPP`

### 4. Gestao SaaS Separada

- carteira de restaurantes
- login e acesso
- vencimentos
- receita por restaurante
- bloqueio/liberacao

## Regras de negocio

- dinheiro e cancelamento sempre com confirmacao humana
- cada restaurante enxerga apenas o proprio bar
- agentes recomendam e executam somente fluxos seguros
- DRE geral e DRE por produto devem sempre ler dados reais do banco

## Resultado comercial esperado

- produto mais confiavel para vender
- menos dependencia de ferramenta terceira
- melhor isolamento entre clientes
- base pronta para crescer para multi-restaurante
