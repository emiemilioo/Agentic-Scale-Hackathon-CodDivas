import sqlite3
from datetime import date

from services.transactions import connect


def initialize_budgets() -> None:
    with connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                month TEXT NOT NULL,
                amount_limit REAL NOT NULL CHECK(amount_limit > 0),
                threshold_pct INTEGER NOT NULL CHECK(threshold_pct BETWEEN 50 AND 100),
                UNIQUE(category, month)
            )
            """
        )


def save_budget(category: str, month: str, amount_limit: float, threshold_pct: int) -> int:
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO budgets(category, month, amount_limit, threshold_pct)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(category, month) DO UPDATE SET
                amount_limit = excluded.amount_limit,
                threshold_pct = excluded.threshold_pct
            """,
            (category, month, amount_limit, threshold_pct),
        )
        row = connection.execute(
            "SELECT id FROM budgets WHERE category = ? AND month = ?", (category, month)
        ).fetchone()
    return int(row["id"])


def evaluate_budget(spent: float, amount_limit: float, threshold_pct: int) -> dict:
    """Cálculo puro y comprobable; no depende de Gemini ni de la BD."""
    percentage = round(spent / amount_limit * 100, 1)
    threshold_amount = round(amount_limit * threshold_pct / 100, 2)
    status = (
        "exceeded" if spent >= amount_limit
        else "warning" if percentage >= threshold_pct
        else "ok"
    )
    return {
        "percentage": percentage,
        "threshold_amount": threshold_amount,
        "status": status,
    }


def list_budgets(month: str | None = None) -> list[dict]:
    month = month or date.today().strftime("%Y-%m")
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT b.id, b.category, b.month, b.amount_limit, b.threshold_pct,
                   COALESCE(SUM(t.amount), 0) AS spent
            FROM budgets b
            LEFT JOIN transactions t
              ON t.category = b.category
             AND substr(t.transaction_date, 1, 7) = b.month
            WHERE b.month = ?
            GROUP BY b.id
            ORDER BY b.category
            """,
            (month,),
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item.update(evaluate_budget(item["spent"], item["amount_limit"], item["threshold_pct"]))
        result.append(item)
    return result


def delete_budget(budget_id: int) -> bool:
    with connect() as connection:
        cursor = connection.execute("DELETE FROM budgets WHERE id = ?", (budget_id,))
    return cursor.rowcount > 0
