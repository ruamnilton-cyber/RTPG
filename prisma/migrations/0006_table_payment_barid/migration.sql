PRAGMA foreign_keys = OFF;

ALTER TABLE "TablePayment" ADD COLUMN "barId" TEXT NOT NULL DEFAULT 'default-bar' REFERENCES "Bar"("id") ON DELETE CASCADE;

PRAGMA foreign_keys = ON;
