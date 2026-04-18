-- Migration 0004: TablePayment (Mercado Pago e outros gateways)
CREATE TABLE IF NOT EXISTS "TablePayment" (
  "id"               TEXT    NOT NULL PRIMARY KEY,
  "saleId"           TEXT,
  "provider"         TEXT    NOT NULL DEFAULT 'MERCADOPAGO',
  "externalId"       TEXT,
  "amount"           REAL    NOT NULL,
  "status"           TEXT    NOT NULL DEFAULT 'PENDENTE',
  "pixQrCode"        TEXT,
  "pixQrCodeBase64"  TEXT,
  "paidAt"           DATETIME,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
