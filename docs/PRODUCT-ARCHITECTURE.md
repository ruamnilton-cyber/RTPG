# RTPG Gestao - Arquitetura recomendada

## Objetivo
Evoluir a base atual para uma plataforma SaaS premium de gestao para bar/restaurante com foco em operacao omnichannel, financeiro forte e IA com ROI.

## Diretriz
- manter a operacao atual funcionando
- evoluir por modulos
- preparar multiunidade sem reescrever tudo
- usar monolito modular como arquitetura principal

## Modulos prioritarios
1. Organizacao e multiunidade preparada
2. Central de pedidos omnichannel
3. Caixa diario
4. Despesas
5. Contas a pagar e receber
6. DRE e fluxo de caixa
7. KDS / cozinha-bar
8. Atendimento IA

## Estrutura alvo
```text
server/src/
  contracts/
  routes/
  services/
  lib/
client/src/
  pages/
  components/
  lib/
  state/
docs/
```

## Evolucao do banco
- curto prazo: continuar usando `SystemSetting` para configuracoes estrategicas e titulos financeiros sem quebrar a base
- medio prazo: migrar para entidades relacionais `company`, `branch`, `payable`, `receivable`, `cashier_session`, `order`

## Regras de rollout
- usar feature flags simples por rota/tela quando necessario
- manter compatibilidade com dados locais dentro do Google Drive
- evitar migracoes destrutivas
