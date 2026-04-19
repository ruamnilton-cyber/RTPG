# Plano Tecnico - Agentes e Fase 1

## Ordem de implementacao
1. Pedido como entidade central
2. Estoque conectado ao pedido
3. Cardapio conectado ao estoque
4. Financeiro relacional
5. WhatsApp com Baileys e QR
6. Relatorios/insights
7. Orquestrador

## Decisoes de arquitetura
- Multi-tenant continua por `Bar`
- IA apenas recomenda; humano confirma dinheiro e cancelamento
- WhatsApp sera por `Baileys`, com sessao salva localmente e reconexao automatica
- Financeiro esta migrando para banco relacional e deixa de depender de storage auxiliar

## Tabelas novas da Fase 1
- `Order`
- `OrderItem`
- `Receivable`
- `Payable`
- `PaymentRecord`

## Rotas novas da Fase 1
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `PATCH /api/orders/:id/status`

## Integracoes feitas na Fase 1
- Sessao de mesa agora gera/sincroniza `Order`
- Itens da mesa sincronizam `OrderItem`
- Fechamento da mesa fecha `Order`
- Fechamento gera `Receivable`
- Fechamento pode gerar `PaymentRecord`
- Despesa gera `Payable`
- DRE e dashboard passam a ler `Receivable` relacional em vez dos titulos antigos em storage
- Financeiro (`/finance`) passou a usar `Payable` e `Receivable`

## Arquivos principais alterados
- `prisma/schema.prisma`
- `scripts/bootstrap_db.py`
- `server/src/routes/orders.ts`
- `server/src/routes/tables.ts`
- `server/src/routes/finance.ts`
- `server/src/routes/reports.ts`
- `server/src/services/orders.ts`
- `server/src/index.ts`

## Proxima sequencia recomendada
1. Ajustar frontend para explorar `Order` de forma nativa
2. Criar status de preparo e entrega no painel operacional
3. Criar tela de pedidos omnichannel
4. Migrar caixa simplificado para modelo relacional
5. Implementar conexao WhatsApp por Baileys
6. Criar tela de QR do WhatsApp com status de conexao
7. Plug de recomendacao com OpenAI sobre contexto do restaurante
