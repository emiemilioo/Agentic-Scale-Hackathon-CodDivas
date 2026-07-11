import json
from pathlib import Path

from services.transactions import connect

KB_PATH = Path(__file__).resolve().parents[1] / "data" / "approved_knowledge.json"

SENSITIVE_TERMS = {
    "fraud": ("fraude", "no reconozco", "no reconocido", "desconozco", "robo"),
    "complaint": ("reclamo", "denuncia", "queja"),
    "block": ("bloquear", "bloqueo", "bloqueen"),
    "regulatory": ("regulatorio", "superintendencia", "lavado", "cumplimiento"),
    "account_access": ("no puedo entrar", "no puedo acceder", "acceso a mi cuenta", "clave bloqueada"),
    "document_issue": ("documento incorrecto", "documento faltante", "estado de cuenta incorrecto", "diferencia en mi estado"),
}

PRIORITIES = {
    "fraud": "HIGH", "block": "HIGH", "regulatory": "HIGH",
    "complaint": "MEDIUM", "account_access": "MEDIUM", "document_issue": "MEDIUM",
}


def initialize_tickets() -> None:
    with connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_type TEXT NOT NULL,
                summary TEXT NOT NULL,
                history TEXT NOT NULL,
                priority TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ESCALATED',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def answer_support(query: str) -> dict:
    lower = query.lower()
    detected = [kind for kind, terms in SENSITIVE_TERMS.items() if any(term in lower for term in terms)]
    if detected:
        return {
            "intent": "sensitive",
            "answer": "Detecté que este caso necesita atención humana. No realizaré bloqueos ni cambios financieros. Puedo crear un ticket con el contexto para que una persona lo revise.",
            "requires_human": True,
            "case_type": detected[0],
            "priority": max(
                (PRIORITIES[kind] for kind in detected),
                key=lambda priority: {"LOW": 1, "MEDIUM": 2, "HIGH": 3}[priority],
            ),
            "sources": ["KB-002 · Operaciones no reconocidas · v1.0"],
        }
    knowledge = json.loads(KB_PATH.read_text(encoding="utf-8"))
    query_words = {word.strip(".,¿?¡!") for word in lower.split() if len(word) > 3}
    ranked = []
    for item in knowledge:
        searchable = f'{item["title"]} {item["content"]}'.lower()
        score = sum(1 for word in query_words if word in searchable)
        ranked.append((score, item))
    score, best = max(ranked, key=lambda pair: pair[0])
    if score == 0:
        return {
            "intent": "unknown",
            "answer": "No encontré una respuesta en la base de conocimiento aprobada. Puedo transferir la consulta a una persona.",
            "requires_human": True,
            "case_type": "unknown",
            "priority": "LOW",
            "sources": [],
        }
    return {
        "intent": "informational",
        "answer": best["content"],
        "requires_human": False,
        "case_type": None,
        "priority": None,
        "sources": [f'{best["id"]} · {best["title"]} · v{best["version"]}'],
    }


def create_ticket(case_type: str, summary: str, history: str, priority: str) -> dict:
    with connect() as connection:
        cursor = connection.execute(
            "INSERT INTO tickets(case_type, summary, history, priority) VALUES (?, ?, ?, ?)",
            (case_type, summary, history, priority),
        )
        ticket_id = int(cursor.lastrowid)
    return {"id": ticket_id, "status": "ESCALATED", "priority": priority}


def list_tickets() -> list[dict]:
    with connect() as connection:
        rows = connection.execute("SELECT * FROM tickets ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]


def update_ticket_status(ticket_id: int, status: str) -> dict | None:
    if status not in {"ESCALATED", "IN_REVIEW", "CLOSED"}:
        raise ValueError("Estado de ticket no permitido.")
    with connect() as connection:
        cursor = connection.execute("UPDATE tickets SET status = ? WHERE id = ?", (status, ticket_id))
        if cursor.rowcount == 0:
            return None
        row = connection.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
    return dict(row)
