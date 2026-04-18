PRAGMA foreign_keys = OFF;

-- ── Sale: add barId ──────────────────────────────────────────────────────────
ALTER TABLE "Sale" ADD COLUMN "barId" TEXT NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE;

-- ── Product: add barId + imageUrl ────────────────────────────────────────────
ALTER TABLE "Product" ADD COLUMN "barId" TEXT NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE;
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;

-- ── Expense: add barId ───────────────────────────────────────────────────────
ALTER TABLE "Expense" ADD COLUMN "barId" TEXT NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE;

-- ── ProductCategory: drop name-unique, add barId, composite unique ────────────
CREATE TABLE "ProductCategory_new" (
  "id"        TEXT     NOT NULL PRIMARY KEY,
  "barId"     TEXT     NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE,
  "name"      TEXT     NOT NULL,
  "sortOrder" INTEGER  NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("barId","name")
);
INSERT INTO "ProductCategory_new" ("id","barId","name","sortOrder","createdAt")
  SELECT "id",'default-bar',"name","sortOrder","createdAt" FROM "ProductCategory";
DROP TABLE "ProductCategory";
ALTER TABLE "ProductCategory_new" RENAME TO "ProductCategory";

-- ── ExpenseCategory: drop name-unique, add barId + groupType, composite unique ─
CREATE TABLE "ExpenseCategory_new" (
  "id"        TEXT     NOT NULL PRIMARY KEY,
  "barId"     TEXT     NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE,
  "name"      TEXT     NOT NULL,
  "groupType" TEXT     NOT NULL DEFAULT 'OPERACIONAL',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("barId","name")
);
INSERT INTO "ExpenseCategory_new" ("id","barId","name","groupType","createdAt")
  SELECT "id",'default-bar',"name",'OPERACIONAL',"createdAt" FROM "ExpenseCategory";
DROP TABLE "ExpenseCategory";
ALTER TABLE "ExpenseCategory_new" RENAME TO "ExpenseCategory";

-- ── Supply: drop name-unique, add barId, composite unique ─────────────────────
CREATE TABLE "Supply_new" (
  "id"           TEXT     NOT NULL PRIMARY KEY,
  "barId"        TEXT     NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE,
  "name"         TEXT     NOT NULL,
  "unit"         TEXT     NOT NULL,
  "averageCost"  REAL     NOT NULL DEFAULT 0,
  "stockCurrent" REAL     NOT NULL DEFAULT 0,
  "stockMinimum" REAL     NOT NULL DEFAULT 0,
  "active"       BOOLEAN  NOT NULL DEFAULT 1,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("barId","name")
);
INSERT INTO "Supply_new" ("id","barId","name","unit","averageCost","stockCurrent","stockMinimum","active","createdAt","updatedAt")
  SELECT "id",'default-bar',"name","unit","averageCost","stockCurrent","stockMinimum","active","createdAt","updatedAt" FROM "Supply";
DROP TABLE "Supply";
ALTER TABLE "Supply_new" RENAME TO "Supply";

-- ── RestaurantTable: drop number-unique, add barId, composite unique ──────────
CREATE TABLE "RestaurantTable_new" (
  "id"          TEXT     NOT NULL PRIMARY KEY,
  "barId"       TEXT     NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE,
  "number"      INTEGER  NOT NULL,
  "name"        TEXT     NOT NULL,
  "status"      TEXT     NOT NULL DEFAULT 'LIVRE',
  "qrCodeToken" TEXT     NOT NULL UNIQUE,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("barId","number")
);
INSERT INTO "RestaurantTable_new" ("id","barId","number","name","status","qrCodeToken","createdAt")
  SELECT "id",'default-bar',"number","name","status","qrCodeToken","createdAt" FROM "RestaurantTable";
DROP TABLE "RestaurantTable";
ALTER TABLE "RestaurantTable_new" RENAME TO "RestaurantTable";

PRAGMA foreign_keys = ON;
