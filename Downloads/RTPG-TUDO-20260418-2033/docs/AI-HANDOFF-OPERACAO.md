# AI Handoff - Operacao do projeto RTPG

Este arquivo existe para orientar qualquer outra IA ou agente que venha a trabalhar neste projeto.

## 1. Objetivo

Manter o sistema funcionando sem quebrar a operacao atual do usuario.

Prioridade:

1. preservar o que ja funciona
2. evitar mexer diretamente no Google Drive para dependencias pesadas
3. subir o sistema de forma estavel
4. validar sempre no navegador

---

## 2. Caminhos importantes

Codigo-fonte principal:

`C:\Users\ruamn\OneDrive\Desktop\trabalhos em python\rtpg`

Copia/sincronizacao no Google Drive:

`G:\Meu Drive\RTPG\Gestor Bar`

Banco local estavel usado nas ultimas correcoes:

`C:\Users\ruamn\OneDrive\Desktop\trabalhos em python\rtpg\storage\rtpg.sqlite`

Pasta de dados no projeto:

`C:\Users\ruamn\OneDrive\Desktop\trabalhos em python\rtpg\storage`

---

## 3. Regra mais importante

Nao instalar ou reconstruir `node_modules` dentro do Google Drive.

Motivo:

- o Google Drive costuma bloquear, sincronizar mal ou corromper escrita de muitos arquivos pequenos
- isso ja causou falha de `npm install`
- isso ja causou falha no Prisma Query Engine do Windows
- isso ja causou instabilidade no SQLite

Conclusao:

- o codigo pode ficar sincronizado no Drive
- mas a execucao pratica deve priorizar a pasta local em `C:\Users\ruamn\OneDrive\Desktop\trabalhos em python\rtpg`

---

## 4. Node que funciona neste ambiente

Usar o Node empacotado pelo Cursor:

`C:\Users\ruamn\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe`

Quando precisar de npm via CLI local, verificar tambem:

`C:\Users\ruamn\OneDrive\Desktop\trabalhos em python\nodejs\node-v20.20.2-win-x64\node_modules\npm\bin\npm-cli.js`

Mas, se possivel, prefira os scripts ja existentes no projeto.

---

## 5. Prisma / banco

Se o servidor cair com erro parecido com:

`Prisma Client could not locate the Query Engine for runtime "windows"`

fazer:

1. abrir terminal na pasta do projeto local
2. rodar:

```powershell
& 'C:\Users\ruamn\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe' '.\scripts\prisma-runner.mjs' generate
```

Isso normalmente repoe o engine do Prisma em `node_modules`.

Se precisar aplicar bootstrap/migracao:

```powershell
python scripts/bootstrap_db.py
```

---

## 6. Como subir o sistema

Subida estavel mais usada:

```powershell
$env:PORT='3334'
& 'C:\Users\ruamn\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe' 'scripts/start.mjs'
```

URL principal:

`http://127.0.0.1:3334/`

Login padrao validado varias vezes:

- email: `admin@rtpg.local`
- senha: `admin123`

---

## 7. Build do frontend

Quando alterar interface, usar:

```powershell
& 'C:\Users\ruamn\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe' '.\node_modules\vite\bin\vite.js' build
```

Depois reiniciar o servidor.

---

## 8. Estado atual do produto

Ja existe no sistema:

- login
- dashboard
- mesas / comanda / fechamento
- taxa de servico em percentual
- taxa com percentual global configuravel
- opcao de cobrar ou nao por comanda
- produtos e cardapio
- DRE por produto
- DRE geral
- receitas manuais entrando na DRE geral
- atualizacao automatica da tela de DRE

---

## 9. Cuidado com a tela de Mesas

Essa tela foi muito ajustada e e sensivel.

Arquivo principal:

`client/src/pages/tables.tsx`

Regras que o usuario pediu e devem ser preservadas:

- escolher a mesa e abrir o fluxo
- cardapio simples e rapido
- permitir multiplas selecoes antes de lancar
- fechamento em etapa separada
- taxa de servico em percentual
- operador pode decidir cobrar ou nao
- se o percentual estiver travado, trava apenas o valor percentual, nao a decisao de cobrar

---

## 10. Cuidado com a DRE

Arquivos principais:

- `server/src/routes/reports.ts`
- `client/src/pages/reports.tsx`
- `client/src/pages/dashboard.tsx`

Regra atual:

- DRE por produto = baseada nas vendas reais dos produtos
- DRE geral = vendas + receitas manuais financeiras - deducoes - CMV - despesas

Nao voltar para o comportamento antigo onde:

- receitas manuais nao entravam na DRE
- lucro bruto ficava maior que faturamento no dashboard

---

## 11. Se outra IA for continuar o trabalho

Ela deve seguir esta ordem:

1. verificar se o servidor sobe na pasta local
2. verificar se a porta `3334` responde
3. so depois mexer em frontend/backend
4. depois de cada mudanca relevante:
   - gerar Prisma se necessario
   - buildar frontend
   - reiniciar servidor
   - validar no navegador

---

## 12. Prompt recomendado para outra IA

Use este texto como ponto de partida:

```text
Voce esta trabalhando no projeto RTPG Gestao.

Codigo-fonte principal:
C:\Users\ruamn\OneDrive\Desktop\trabalhos em python\rtpg

Nao use o Google Drive para instalar node_modules ou para rodar a aplicacao principal.
Use a pasta local do projeto para executar tudo.

Node funcional:
C:\Users\ruamn\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe

Se o Prisma quebrar por falta de engine, rode:
node scripts/prisma-runner.mjs generate

Servidor estavel:
porta 3334
URL: http://127.0.0.1:3334/

Prioridade absoluta:
preservar o que ja funciona.

Areas sensiveis:
- mesas/comandas
- fechamento
- taxa de servico
- DRE
- dashboard

Sempre validar as mudancas na pratica depois de editar.
Nao simplifique o sistema sem autorizacao explicita do usuario.
Nao mova node_modules para o Google Drive.
```

---

## 13. O que nao fazer

- nao apagar partes importantes sem confirmar
- nao trocar a base local estavel pela do Drive sem necessidade
- nao assumir que o npm no PATH funciona
- nao instalar dependencias pesadas direto em `G:\Meu Drive\RTPG\Gestor Bar`
- nao alterar a logica da DRE sem conferir vendas, receitas manuais e despesas juntas

---

## 14. Ultima observacao

Se houver duvida entre:

- "ficar bonito"
- "continuar funcionando"

escolher primeiro continuar funcionando.
