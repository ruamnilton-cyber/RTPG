# Plano de migracao incremental

## Fase 1
- manter SQLite atual
- manter tabelas existentes
- adicionar configuracoes novas via `SystemSetting`
- liberar telas novas no frontend

## Fase 2
- criar entidades relacionais novas em Prisma
- fazer backfill automatico da unidade principal
- passar financeiro de settings para tabelas reais

## Fase 3
- migrar central de pedidos para dominio unico `orders`
- conectar caixa, KDS, CRM e canais externos

## Garantias
- nenhuma funcao existente deve ser removida antes da equivalencia
- toda migracao deve permitir rollback
- sempre preservar pasta ativa no Google Drive
