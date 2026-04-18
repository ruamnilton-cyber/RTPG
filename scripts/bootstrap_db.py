import sqlite3
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = Path(os.environ.get("RTPG_DATA_DIR", str(ROOT)))
DB_PATH = DATA_ROOT / "storage" / "rtpg.sqlite"
MIGRATION = ROOT / "prisma" / "migrations" / "0001_init" / "migration.sql"

DB_PATH.parent.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    return cursor.fetchone() is not None


def column_exists(cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(f"PRAGMA table_info('{table_name}')")
    return any(row["name"] == column_name for row in cursor.fetchall())


def migrate_multi_bar(cursor) -> None:
    """Multi-bar: Bar, UserBar, barId nas entidades operacionais (idempotente)."""
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS "Bar" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "active" INTEGER NOT NULL DEFAULT 1,
          "city" TEXT NOT NULL DEFAULT '',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Bar_code_key" ON "Bar"("code")')

    cursor.execute('SELECT "id" FROM "Bar" WHERE "code" = ?', ("principal",))
    row = cursor.fetchone()
    if row:
        default_bar_id = row["id"]
    else:
        default_bar_id = "bar_rtpg_principal"
        cursor.execute(
            'INSERT OR IGNORE INTO "Bar" ("id", "name", "code", "active", "city") VALUES (?, ?, ?, 1, ?)',
            (default_bar_id, "Bar principal", "principal", ""),
        )
        cursor.execute('SELECT "id" FROM "Bar" WHERE "code" = ?', ("principal",))
        r2 = cursor.fetchone()
        if r2:
            default_bar_id = r2["id"]

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS "UserBar" (
          "userId" TEXT NOT NULL,
          "barId" TEXT NOT NULL,
          PRIMARY KEY ("userId", "barId"),
          CONSTRAINT "UserBar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "UserBar_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
        """
    )
    if table_exists(cursor, "User"):
        cursor.execute(
            """
            INSERT OR IGNORE INTO "UserBar" ("userId", "barId")
            SELECT "id", ? FROM "User"
            """,
            (default_bar_id,),
        )

    for tbl in (
        "ProductCategory",
        "Product",
        "Supply",
        "RestaurantTable",
        "Sale",
        "ExpenseCategory",
        "Expense",
    ):
        if table_exists(cursor, tbl) and not column_exists(cursor, tbl, "barId"):
            cursor.execute(f'ALTER TABLE "{tbl}" ADD COLUMN "barId" TEXT')

    for tbl in (
        "ProductCategory",
        "Product",
        "Supply",
        "RestaurantTable",
        "ExpenseCategory",
    ):
        if table_exists(cursor, tbl) and column_exists(cursor, tbl, "barId"):
            cursor.execute(f'UPDATE "{tbl}" SET "barId" = ? WHERE "barId" IS NULL OR "barId" = ""', (default_bar_id,))

    if table_exists(cursor, "Sale") and column_exists(cursor, "Sale", "barId"):
        cursor.execute(f'UPDATE "Sale" SET "barId" = ? WHERE "barId" IS NULL OR "barId" = ""', (default_bar_id,))
        cursor.execute(
            """
            UPDATE "Sale" SET "barId" = (
              SELECT "rt"."barId" FROM "TableSession" AS "ts"
              INNER JOIN "RestaurantTable" AS "rt" ON "rt"."id" = "ts"."tableId"
              WHERE "ts"."id" = "Sale"."tableSessionId"
            )
            WHERE "Sale"."tableSessionId" IS NOT NULL
            """
        )
        cursor.execute(
            f'UPDATE "Sale" SET "barId" = ? WHERE "barId" IS NULL OR "barId" = ""',
            (default_bar_id,),
        )

    if table_exists(cursor, "Expense") and column_exists(cursor, "Expense", "barId"):
        if column_exists(cursor, "ExpenseCategory", "barId"):
            cursor.execute(
                """
                UPDATE "Expense" SET "barId" = (
                  SELECT "ec"."barId" FROM "ExpenseCategory" AS "ec" WHERE "ec"."id" = "Expense"."categoryId"
                )
                WHERE "barId" IS NULL OR "barId" = ""
                """
            )
        cursor.execute(
            f'UPDATE "Expense" SET "barId" = ? WHERE "barId" IS NULL OR "barId" = ""',
            (default_bar_id,),
        )

    cursor.execute('DROP INDEX IF EXISTS "ProductCategory_name_key"')
    cursor.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_barId_name_key" ON "ProductCategory"("barId", "name")'
    )

    cursor.execute('DROP INDEX IF EXISTS "Supply_name_key"')
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Supply_barId_name_key" ON "Supply"("barId", "name")')

    cursor.execute('DROP INDEX IF EXISTS "RestaurantTable_number_key"')
    cursor.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_barId_number_key" ON "RestaurantTable"("barId", "number")'
    )

    cursor.execute('DROP INDEX IF EXISTS "ExpenseCategory_name_key"')
    cursor.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_barId_name_key" ON "ExpenseCategory"("barId", "name")'
    )


def migrate_orders_and_finance(cursor) -> None:
    if table_exists(cursor, "TableSession") and not column_exists(cursor, "TableSession", "orderId"):
        cursor.execute('ALTER TABLE "TableSession" ADD COLUMN "orderId" TEXT')
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS "TableSession_orderId_key" ON "TableSession"("orderId")')

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS "Order" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "barId" TEXT NOT NULL,
          "tableId" TEXT,
          "tableSessionId" TEXT,
          "createdByUserId" TEXT,
          "channel" TEXT NOT NULL DEFAULT 'SALAO',
          "status" TEXT NOT NULL DEFAULT 'ABERTO',
          "customerName" TEXT,
          "notes" TEXT,
          "subtotal" REAL NOT NULL DEFAULT 0,
          "deductionsAmount" REAL NOT NULL DEFAULT 0,
          "serviceFeeAmount" REAL NOT NULL DEFAULT 0,
          "totalAmount" REAL NOT NULL DEFAULT 0,
          "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "closedAt" DATETIME,
          CONSTRAINT "Order_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "Order_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "Order_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
        """
    )
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Order_tableSessionId_key" ON "Order"("tableSessionId")')
    cursor.execute('CREATE INDEX IF NOT EXISTS "Order_barId_status_openedAt_idx" ON "Order"("barId", "status", "openedAt")')

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS "OrderItem" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "orderId" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "unitPrice" REAL NOT NULL,
          "totalPrice" REAL NOT NULL,
          "notes" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        )
        """
    )
    cursor.execute('CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId")')

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS "Payable" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "barId" TEXT NOT NULL,
          "expenseId" TEXT,
          "description" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "costCenter" TEXT NOT NULL DEFAULT 'OPERACAO',
          "amount" REAL NOT NULL,
          "dueDate" DATETIME NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDENTE',
          "counterparty" TEXT NOT NULL DEFAULT '',
          "notes" TEXT NOT NULL DEFAULT '',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "paidAt" DATETIME,
          CONSTRAINT "Payable_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Payable_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
        """
    )
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Payable_expenseId_key" ON "Payable"("expenseId")')
    cursor.execute('CREATE INDEX IF NOT EXISTS "Payable_barId_status_dueDate_idx" ON "Payable"("barId", "status", "dueDate")')

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS "Receivable" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "barId" TEXT NOT NULL,
          "orderId" TEXT,
          "saleId" TEXT,
          "description" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "costCenter" TEXT NOT NULL DEFAULT 'OPERACAO',
          "amount" REAL NOT NULL,
          "dueDate" DATETIME NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDENTE',
          "counterparty" TEXT NOT NULL DEFAULT '',
          "notes" TEXT NOT NULL DEFAULT '',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "paidAt" DATETIME,
          CONSTRAINT "Receivable_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Receivable_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "Receivable_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
        """
    )
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Receivable_orderId_key" ON "Receivable"("orderId")')
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Receivable_saleId_key" ON "Receivable"("saleId")')
    cursor.execute('CREATE INDEX IF NOT EXISTS "Receivable_barId_status_dueDate_idx" ON "Receivable"("barId", "status", "dueDate")')

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS "PaymentRecord" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "barId" TEXT NOT NULL,
          "orderId" TEXT,
          "saleId" TEXT,
          "payableId" TEXT,
          "receivableId" TEXT,
          "method" TEXT NOT NULL DEFAULT 'PIX',
          "amount" REAL NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
          "paidAt" DATETIME,
          "notes" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PaymentRecord_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "PaymentRecord_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "PaymentRecord_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "PaymentRecord_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
        """
    )
    cursor.execute('CREATE INDEX IF NOT EXISTS "PaymentRecord_barId_createdAt_idx" ON "PaymentRecord"("barId", "createdAt")')


try:
    sql = MIGRATION.read_text(encoding="utf-8")
    try:
        conn.executescript(sql)
    except sqlite3.IntegrityError:
        pass
    cursor = conn.cursor()

    if not column_exists(cursor, "ProductCategory", "sortOrder"):
        cursor.execute("ALTER TABLE 'ProductCategory' ADD COLUMN 'sortOrder' INTEGER NOT NULL DEFAULT 0")

    if not column_exists(cursor, "Product", "imageUrl"):
        cursor.execute("ALTER TABLE 'Product' ADD COLUMN 'imageUrl' TEXT")

    if not column_exists(cursor, "ExpenseCategory", "groupType"):
        cursor.execute("ALTER TABLE 'ExpenseCategory' ADD COLUMN 'groupType' TEXT NOT NULL DEFAULT 'OPERACIONAL'")

    if not table_exists(cursor, "SystemSetting"):
        cursor.execute("""
            CREATE TABLE "SystemSetting" (
              "id" TEXT NOT NULL PRIMARY KEY,
              "key" TEXT NOT NULL,
              "value" TEXT NOT NULL,
              "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS 'SystemSetting_key_key' ON 'SystemSetting'('key')")

    cursor.execute("UPDATE 'ProductCategory' SET 'sortOrder' = rowid - 1 WHERE COALESCE('sortOrder', 0) = 0")
    migrate_multi_bar(cursor)
    migrate_orders_and_finance(cursor)
    conn.commit()
finally:
    conn.close()

print(f"Banco inicializado em: {DB_PATH}")
