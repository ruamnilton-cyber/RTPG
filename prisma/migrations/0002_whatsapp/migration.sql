-- Migration 0002: WhatsApp integration
-- Tabelas novas + campos ausentes que o código já usa

PRAGMA foreign_keys = OFF;

-- SystemSetting (usada por system-settings.ts para persistência de configs JSON)
CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "key"       TEXT     NOT NULL PRIMARY KEY,
  "value"     TEXT     NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- sortOrder na categoria de produto (já usado por catalog.ts)
-- SQLite não suporta IF NOT EXISTS em ADD COLUMN; usamos o bloco abaixo via script Python.
-- A coluna é adicionada condicionalmente pelo bootstrap_db.py.

-- Conversas WhatsApp (estado de cada número)
CREATE TABLE IF NOT EXISTS "WhatsappConversation" (
  "id"            TEXT     NOT NULL PRIMARY KEY,
  "phone"         TEXT     NOT NULL,
  "customerName"  TEXT,
  "state"         TEXT     NOT NULL DEFAULT 'IDLE',
  "context"       TEXT,
  "lastOrderId"   TEXT,
  "lastMessageAt" DATETIME,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappConversation_phone_key" ON "WhatsappConversation"("phone");

-- Pedidos originados pelo WhatsApp
CREATE TABLE IF NOT EXISTS "WhatsappOrder" (
  "id"            TEXT     NOT NULL PRIMARY KEY,
  "phone"         TEXT     NOT NULL,
  "customerName"  TEXT,
  "channel"       TEXT     NOT NULL DEFAULT 'WHATSAPP',
  "status"        TEXT     NOT NULL DEFAULT 'NOVO',
  "totalAmount"   REAL     NOT NULL DEFAULT 0,
  "notes"         TEXT,
  "paymentStatus" TEXT     NOT NULL DEFAULT 'PENDENTE',
  "confirmedBy"   TEXT,
  "confirmedAt"   DATETIME,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Itens dos pedidos WhatsApp
CREATE TABLE IF NOT EXISTS "WhatsappOrderItem" (
  "id"          TEXT     NOT NULL PRIMARY KEY,
  "orderId"     TEXT     NOT NULL,
  "productId"   TEXT,
  "productName" TEXT     NOT NULL,
  "quantity"    INTEGER  NOT NULL DEFAULT 1,
  "unitPrice"   REAL     NOT NULL,
  "totalPrice"  REAL     NOT NULL,
  "notes"       TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappOrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "WhatsappOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WhatsappOrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Links de pagamento associados a pedidos
CREATE TABLE IF NOT EXISTS "PaymentLink" (
  "id"        TEXT     NOT NULL PRIMARY KEY,
  "orderId"   TEXT     NOT NULL,
  "url"       TEXT     NOT NULL,
  "amount"    REAL     NOT NULL,
  "status"    TEXT     NOT NULL DEFAULT 'PENDENTE',
  "expiresAt" DATETIME,
  "paidAt"    DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentLink_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "WhatsappOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

PRAGMA foreign_keys = ON;
