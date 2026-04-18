# Manual do Sistema RTPG Gestao

## 1. Objetivo do sistema
O `RTPG Gestao` e uma plataforma de gestao para bares e restaurantes com foco em:
- operacao de mesas e comandas
- cardapio e produtos
- estoque e insumos
- financeiro e DRE
- clientes e CRM
- gestao dos seus clientes SaaS
- estrutura para atendimento com IA

Este manual serve para:
- estudar o produto
- entender os modulos
- demonstrar nas vendas
- operar o sistema no dia a dia

---

## 2. Tipos de cliente dentro do sistema

### 2.1 Clientes do restaurante
Sao os consumidores finais do bar/restaurante.

Ficam na tela:
- `Clientes`

Uso:
- cadastrar nome, WhatsApp, email e Instagram
- registrar origem do cliente
- marcar cliente VIP
- guardar observacoes e preferencias
- acompanhar ticket medio e frequencia

### 2.2 Clientes SaaS
Sao os restaurantes que alugam o seu sistema.

Ficam na tela:
- `Clientes SaaS`

Uso:
- controlar mensalidades
- acompanhar vencimentos
- marcar cliente em atraso
- liberar ou bloquear acesso
- registrar plano, unidades e observacoes comerciais

---

## 3. Acesso ao sistema

Tela:
- `Login`

Permite:
- entrar com email e senha
- cadastrar usuario
- recuperar acesso

Perfis atuais:
- `ADMIN`
- `GERENTE`
- `CAIXA`
- `GARCOM`
- `COZINHA`
- `FINANCEIRO`
- `OPERADOR`

Recomendacao para demonstracao:
- usar conta `ADMIN`

---

## 4. Menu principal

### Dashboard
Visao executiva inicial do negocio.

Mostra:
- faturamento do dia
- lucro bruto estimado
- mesas em operacao
- itens no cardapio
- estoque total

### Organizacao
Tela para configurar a empresa e preparar multiunidade.

Permite:
- definir nome da empresa
- informar CNPJ
- escolher foco da operacao
- habilitar canais
- preparar estrutura de filiais

### Pedidos
Central operacional inicial do sistema.

Mostra:
- mesas abertas
- fechamentos pendentes
- chamados do salao
- vendas recentes

### Mesas
Operacao direta de salao.

Permite:
- abrir mesa
- adicionar itens
- remover itens
- acompanhar subtotal
- colocar mesa aguardando fechamento
- fechar conta

### Cozinha / Bar
Tela preparada para operacao de producao.

Uso futuro:
- fila de pedidos
- status por estacao
- tempo de preparo

### Cardapio
Tela de produtos vendidos.

Permite:
- cadastrar produtos
- editar produtos
- excluir produtos
- filtrar por categoria
- trabalhar com grade visual

### Insumos
Cadastro dos itens usados nas receitas.

Permite:
- cadastrar insumos
- controlar custo medio
- controlar estoque minimo

### Ficha tecnica
Relaciona produtos aos insumos.

Uso:
- calcular custo
- preparar baixa de estoque

### Estoque
Controle de entradas, saidas e movimentacoes.

### Clientes
CRM do restaurante.

Permite:
- cadastrar clientes finais
- registrar canal preferido
- marcar status VIP
- guardar observacoes
- preparar relacionamento via WhatsApp/Instagram/QR

### Caixa
Controle do caixa diario por operador.

Permite:
- abrir caixa
- registrar sangria
- registrar reforco
- registrar ajuste
- fechar caixa
- acompanhar divergencia

### Financeiro
Visao financeira gerencial.

Permite:
- contas a pagar
- contas a receber
- fluxo projetado
- leitura resumida do negocio

### DRE
Relatorio economico do negocio.

Uso:
- receita
- custo
- lucro bruto
- despesas
- resultado operacional

### Relatorios
Central preparada para relatorios consolidados.

### Painel IA
Gestao da camada de automacao.

Permite:
- configurar assistente
- ajustar limiar de handoff
- acompanhar automacao estimada
- simular handoff para atendimento humano

### Clientes SaaS
Seu painel comercial interno.

Permite:
- cadastrar restaurantes clientes
- definir plano
- definir mensalidade
- acompanhar vencimentos
- marcar atraso
- bloquear ou liberar acesso

### QR Codes
Gestao dos QR Codes por mesa.

### Reservas
Estrutura preparada para reservas.

### Usuarios
Gestao de usuarios internos do sistema.

### Configuracoes
Dados institucionais, tema, branding e seguranca.

---

## 5. Como fazer uma demonstracao comercial

### Passo 1. Mostrar o valor principal
Explique:
- o sistema centraliza operacao, financeiro e clientes
- o dono passa a ter visao do negocio
- a equipe ganha velocidade operacional

### Passo 2. Mostrar a operacao
Apresente:
- `Mesas`
- `Pedidos`
- `Caixa`

Fale:
- abertura de comanda
- fechamento de conta
- controle do fluxo operacional

### Passo 3. Mostrar o cardapio
Apresente:
- `Cardapio`
- `Insumos`
- `Ficha tecnica`

Fale:
- padronizacao
- calculo de custo
- preparo para controle de estoque

### Passo 4. Mostrar o financeiro
Apresente:
- `Financeiro`
- `DRE`
- `Caixa`

Fale:
- contas a pagar e receber
- fluxo de caixa
- leitura clara do resultado

### Passo 5. Mostrar o CRM
Apresente:
- `Clientes`
- `Painel IA`

Fale:
- preparo para WhatsApp
- base de relacionamento
- automacao futura com contexto

### Passo 6. Mostrar sua capacidade de escala
Apresente:
- `Organizacao`
- `Clientes SaaS`

Fale:
- multiunidade preparada
- modelo de assinatura
- controle comercial dos clientes do sistema

---

## 6. Como usar Clientes SaaS

Tela:
- `Clientes SaaS`

### Cadastro
Preencha:
- nome do restaurante
- responsavel
- WhatsApp
- email
- cidade
- plano
- mensalidade
- dia de vencimento
- proximo vencimento
- status
- status de acesso
- unidades
- observacoes

### Status de negocio
- `TRIAL`: ainda em avaliacao
- `ATIVO`: cliente em operacao normal
- `ATRASADO`: cliente com pagamento pendente
- `SUSPENSO`: cliente parado temporariamente
- `CANCELADO`: contrato encerrado

### Status de acesso
- `LIBERADO`: uso normal
- `BLOQUEIO_AVISO`: cliente avisado sobre atraso
- `BLOQUEADO`: acesso interrompido

### Uso recomendado
Toda semana:
- revisar vencimentos
- ver quem esta em atraso
- atualizar ultimo pagamento
- registrar combinados em observacoes

---

## 7. Como usar Clientes

Tela:
- `Clientes`

Cadastre:
- nome
- WhatsApp
- email
- Instagram
- cidade
- canal preferido
- origem
- status
- ticket medio
- quantidade de visitas
- ultimo pedido
- tags
- observacoes

Exemplos de tags:
- `vip`
- `cliente-frequente`
- `ama-camarao`
- `delivery-centro`
- `pede-whatsapp`

---

## 8. Como usar o Caixa

Tela:
- `Caixa`

Fluxo:
1. abrir caixa com saldo inicial
2. registrar sangrias e reforcos
3. acompanhar saldo esperado
4. informar valor contado
5. fechar caixa
6. justificar divergencia se houver

Beneficio comercial para venda:
- o dono para de depender de controle manual
- passa a ter rastreabilidade por operador

---

## 9. Como usar o Financeiro

Tela:
- `Financeiro`

Permite:
- cadastrar titulo a pagar
- cadastrar titulo a receber
- ver valores em aberto
- acompanhar fluxo projetado

Beneficio comercial:
- o restaurante nao olha so faturamento
- passa a enxergar compromisso financeiro real

---

## 10. Como usar o Painel IA

Tela:
- `Painel IA`

Permite:
- nomear o assistente
- ativar resposta automatica
- ativar interpretacao de audio
- ativar upsell
- configurar limiar de handoff

Mensagem comercial boa:
- o sistema prepara a operacao para vender por WhatsApp com menos dependencia humana

---

## 11. Como vender este sistema

### Dores que ele resolve
- desorganizacao no atendimento
- falta de controle de caixa
- cardapio sem padrao
- estoque sem criterio
- falta de visao financeira
- dificuldade para crescer

### Argumentos fortes
- sistema local e persistente
- visual profissional
- preparado para omnichannel
- financeiro melhor que sistemas focados so em pedido
- pronto para evoluir para IA e WhatsApp
- serve para bar, restaurante e operacao hibrida

### Perfil ideal de venda
- bares locais
- restaurantes pequenos e medios
- negocios que vendem em salao e delivery
- operacoes que ainda fazem muito controle manual

---

## 12. Roteiro curto de apresentacao

1. mostrar Dashboard
2. mostrar Mesas e Pedidos
3. mostrar Cardapio
4. mostrar Caixa
5. mostrar Financeiro
6. mostrar Clientes
7. explicar Painel IA
8. fechar com Organizacao e visao de crescimento

---

## 13. O que estudar primeiro

Ordem recomendada:
1. Login e perfis
2. Mesas
3. Pedidos
4. Cardapio
5. Caixa
6. Financeiro
7. Clientes
8. Clientes SaaS
9. Painel IA
10. DRE

---

## 14. Proximas melhorias recomendadas

- alerta automatico de vencimento do cliente SaaS
- bloqueio automatico por atraso
- geracao de login por restaurante
- historico de pagamentos do cliente SaaS
- captura automatica de clientes por WhatsApp e QR
- vinculo do cliente ao pedido/comanda
- CRM com recorrencia real
- operacao online com instancias separadas por cliente
