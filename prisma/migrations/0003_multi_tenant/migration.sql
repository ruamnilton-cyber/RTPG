-- CreateTable: Bar (restaurante/unidade)
CREATE TABLE "Bar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: UserBar (vínculo usuário ↔ restaurante)
CREATE TABLE "UserBar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "barId" TEXT NOT NULL,
    CONSTRAINT "UserBar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBar_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: slug único para Bar
CREATE UNIQUE INDEX "Bar_slug_key" ON "Bar"("slug");

-- CreateIndex: unique userId+barId
CREATE UNIQUE INDEX "UserBar_userId_barId_key" ON "UserBar"("userId", "barId");

-- Inserir bar padrão para migração de dados existentes
INSERT INTO "Bar" ("id", "name", "slug", "active", "createdAt", "updatedAt")
VALUES ('default-bar', 'Restaurante Principal', 'principal', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Vincular todos os usuários existentes ao bar padrão
INSERT INTO "UserBar" ("id", "userId", "barId")
SELECT ('ub-' || "id"), "id", 'default-bar' FROM "User";

-- ─── WhatsappConversation: adicionar barId ───────────────────────────────────

-- Remover índice único antigo (phone)
DROP INDEX IF EXISTS "WhatsappConversation_phone_key";

-- Adicionar coluna barId com valor padrão para dados existentes
ALTER TABLE "WhatsappConversation" ADD COLUMN "barId" TEXT NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE;

-- Criar índice composto único (barId + phone)
CREATE UNIQUE INDEX "WhatsappConversation_barId_phone_key" ON "WhatsappConversation"("barId", "phone");

-- ─── WhatsappOrder: adicionar barId ──────────────────────────────────────────

ALTER TABLE "WhatsappOrder" ADD COLUMN "barId" TEXT NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE;
