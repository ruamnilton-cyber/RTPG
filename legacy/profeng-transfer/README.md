# Profeng RTPG Transfer

Arquivos preservados do antigo repositório `profeng` que pertencem ao RTPG, mas não foram ativados diretamente no runtime do repositório oficial.

Motivos principais:

- Alguns serviços dependem de modelos Prisma que não existem no schema atual do RTPG oficial.
- O RTPG oficial já possui versões mais novas para pagamentos e WhatsApp.
- Manter estes arquivos fora de `client/`, `server/`, `prisma/` e `scripts/` evita quebra de build enquanto preserva o trabalho para migração futura.

Quando for migrar algo desta pasta, compare schema, rotas e dependências antes de mover para o código ativo.
