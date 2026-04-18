import sqlite3
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_0001 = ROOT / "prisma" / "migrations" / "0001_init" / "migration.sql"
MIGRATION_0002 = ROOT / "prisma" / "migrations" / "0002_whatsapp" / "migration.sql"
MIGRATION_0003 = ROOT / "prisma" / "migrations" / "0003_multi_tenant" / "migration.sql"
MIGRATION_0004 = ROOT / "prisma" / "migrations" / "0004_payments" / "migration.sql"


def resolve_base_dir():
    env_dir = os.environ.get("RTPG_DATA_DIR")
    candidates = []
    if env_dir:
        candidates.append(Path(env_dir))

    # Prioriza banco junto do projeto para facilitar portabilidade entre PCs.
    candidates.append(ROOT / "rtpg_local")

    local_appdata = os.environ.get("LOCALAPPDATA")
    if local_appdata:
        candidates.append(Path(local_appdata) / "RTPG")

    candidates.extend(
        [
            Path.home() / "Documents" / "rtpg",
            Path.home() / ".rtpg",
            ROOT,
        ]
    )

    for candidate in candidates:
        try:
            (candidate / "storage").mkdir(parents=True, exist_ok=True)
            return candidate.resolve()
        except OSError:
            continue

    return ROOT.resolve()


def column_exists(conn, table, column):
    rows = conn.execute(f"PRAGMA table_info(\"{table}\")").fetchall()
    return any(row[1] == column for row in rows)


def table_exists(conn, table):
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1", (table,)
    ).fetchone()
    return row is not None


BASE_DIR = resolve_base_dir()
DB_PATH = BASE_DIR / "storage" / "rtpg.sqlite"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
try:
    # ── Migration 0001: bootstrap inicial ────────────────────────────────────
    has_user_table = table_exists(conn, "User")
    if not has_user_table:
        sql = MIGRATION_0001.read_text(encoding="utf-8")
        conn.executescript(sql)
        conn.commit()
        print("Migration 0001 aplicada.")
    else:
        print("Migration 0001 já aplicada.")

    # ── Migration 0002: WhatsApp + campos ausentes ────────────────────────────
    has_wpp_table = table_exists(conn, "WhatsappOrder")
    if not has_wpp_table:
        sql = MIGRATION_0002.read_text(encoding="utf-8")
        conn.executescript(sql)
        conn.commit()
        print("Migration 0002 aplicada.")
    else:
        print("Migration 0002 já aplicada.")

    # ── Migration 0003: Multi-tenant (Bar/UserBar) + barId nas tabelas WPP ──
    has_bar_table = table_exists(conn, "Bar")
    if not has_bar_table:
        sql = MIGRATION_0003.read_text(encoding="utf-8")
        conn.executescript(sql)
        conn.commit()
        print("Migration 0003 aplicada.")
    else:
        print("Migration 0003 já aplicada.")
        # Garante que barId existe nas tabelas WhatsApp mesmo se Bar já existia
        if not column_exists(conn, "WhatsappConversation", "barId"):
            conn.execute(
                'ALTER TABLE "WhatsappConversation" ADD COLUMN "barId" TEXT NOT NULL DEFAULT "default-bar" REFERENCES "Bar"("id") ON DELETE CASCADE'
            )
            conn.commit()
            print("Coluna barId adicionada em WhatsappConversation.")
        if not column_exists(conn, "WhatsappOrder", "barId"):
            conn.execute(
                'ALTER TABLE "WhatsappOrder" ADD COLUMN "barId" TEXT NOT NULL DEFAULT "default-bar" REFERENCES "Bar"("id") ON DELETE CASCADE'
            )
            conn.commit()
            print("Coluna barId adicionada em WhatsappOrder.")

    # ── Migration 0004: TablePayment ─────────────────────────────────────────
    has_payment_table = table_exists(conn, "TablePayment")
    if not has_payment_table:
        sql = MIGRATION_0004.read_text(encoding="utf-8")
        conn.executescript(sql)
        conn.commit()
        print("Migration 0004 aplicada.")
    else:
        print("Migration 0004 já aplicada.")

    # ── Adição condicional de sortOrder em ProductCategory ───────────────────
    if not column_exists(conn, "ProductCategory", "sortOrder"):
        conn.execute(
            'ALTER TABLE "ProductCategory" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0'
        )
        conn.commit()
        print("Coluna sortOrder adicionada em ProductCategory.")

finally:
    conn.close()

print(f"Banco inicializado em: {DB_PATH}")
