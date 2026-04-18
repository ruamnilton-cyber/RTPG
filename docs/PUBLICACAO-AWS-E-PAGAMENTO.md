# Publicacao AWS e Cobranca SaaS

## 1) Objetivo

Colocar o RTPG online para vender assinatura a restaurantes, com:

- auto cadastro de restaurante (trial)
- cobranca dentro do painel (Pix e cartao)
- isolamento por restaurante (multi-tenant por bar)

## 2) Deploy rapido na AWS (EC2 + Docker)

### 2.1 Criar instancia

- EC2 Ubuntu 22.04 (t3.small ja atende MVP)
- abrir portas: `22`, `80`, `443`
- anexar dominio (Route53 ou Cloudflare)

### 2.2 Instalar Docker na EC2

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 2.3 Subir o app

```bash
git clone <seu-repo>
cd rtpg
cp .env.example .env
```

Preencha `.env` com:

- `OPENAI_API_KEY`
- `SAAS_PIX_KEY`
- `SAAS_PIX_RECIPIENT_NAME`
- `SAAS_PIX_CITY`
- `SAAS_CARD_CHECKOUT_URL` (link do provedor de cartao)
- `SAAS_BILLING_WEBHOOK_SECRET`
- `APP_BASE_URL=https://app.seudominio.com`

Subir:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 2.4 HTTPS (obrigatorio)

Recomendado: Nginx + Certbot na EC2 (ou Cloudflare Tunnel / ALB com ACM).

## 3) Cobranca no sistema

### 3.1 Configurar no Meu Gestor

Tela: `Meu Gestor > Carteira > Configuracao de cobranca`

- Chave Pix de recebimento
- Nome/cidade do Pix
- URL de checkout de cartao (template com placeholders)
- URL publica do app
- Segredo do webhook

### 3.2 Fluxo do restaurante

1. Restaurante entra no painel.
2. Clica em pagar assinatura com Pix ou cartao.
3. Pix gera QR code + copia e cola.
4. Cartao abre checkout externo.
5. Webhook confirma pagamento e registra receita no gestor.

## 4) Endpoint de webhook

`POST /api/auth/billing-webhook/confirm`

Headers:

- `x-rtpg-signature`: HMAC SHA256 do `token` enviado no body usando `SAAS_BILLING_WEBHOOK_SECRET`

Body:

```json
{
  "clientId": "id_cliente",
  "amount": 149,
  "paidAt": "2026-04-18T12:00:00.000Z",
  "referenceMonth": "2026-04",
  "notes": "Pagamento gateway",
  "token": "idempotency-ou-token-do-gateway"
}
```

## 5) Placeholder da URL de cartao

`SAAS_CARD_CHECKOUT_URL` aceita:

- `{amount}`
- `{client_id}`
- `{restaurant}`
- `{access_login}`
- `{due_date}`
- `{reference_month}`

Exemplo:

```text
https://checkout.seugateway.com/pay?amount={amount}&external_id={client_id}&description={restaurant}
```

## 6) Proximos passos comerciais

- plugar gateway oficial (Mercado Pago / Asaas / Stripe)
- criar notificacao de vencimento por WhatsApp
- bloquear acesso automatico por atraso (janela de tolerancia)
- emitir nota de servico da assinatura (NFS-e) no seu CNPJ
