# API Contracts iniciais

## Organizacao
- `GET /api/organization`
- `PUT /api/organization`
- `POST /api/organization/branches`
- `PUT /api/organization/branches/:id`

## Financeiro
- `GET /api/finance/overview`
- `GET /api/finance/titles`
- `POST /api/finance/titles`
- `PATCH /api/finance/titles/:id`

## IA
- `GET /api/ai/panel`
- `PUT /api/ai/panel`
- `POST /api/ai/handoff`

## Contratos minimos

### POST /api/finance/titles
```json
{
  "kind": "PAGAR",
  "description": "Aluguel da unidade",
  "category": "Aluguel",
  "branchId": "branch-main",
  "costCenter": "ADMINISTRATIVO",
  "amount": 1800,
  "dueDate": "2026-04-30",
  "status": "PENDENTE",
  "counterparty": "Locador",
  "notes": ""
}
```

### PUT /api/ai/panel
```json
{
  "assistantName": "RTPG AI",
  "handoffThreshold": 65,
  "estimatedAutomationRate": 42,
  "autoReplyEnabled": true,
  "audioTranscriptionEnabled": true,
  "upsellEnabled": true
}
```
