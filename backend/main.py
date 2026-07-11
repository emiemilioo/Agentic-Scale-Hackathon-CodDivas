import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agent.gemini_client import ExpenseExtractor
from backend.api_schemas import (
    ConfirmExpenseRequest,
    ConfirmExpenseResponse,
    InterpretRequest,
    InterpretResponse,
    SummaryResponse,
    BudgetRequest,
    BudgetResponse,
    SupportRequest,
    TicketRequest,
    TicketStatusRequest,
)
from services.budgets import delete_budget, initialize_budgets, list_budgets, save_budget
from services.transactions import (
    initialize_database,
    list_expenses,
    register_expense,
    total_expenses,
)
from services.validation import validate_expense
from services.support import answer_support, create_ticket, initialize_tickets, list_tickets, update_ticket_status

app = FastAPI(
    title="Saldo Claro API",
    version="0.1.0",
    description="API financiera con acciones validadas y confirmación humana.",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

extractor = ExpenseExtractor()


@app.on_event("startup")
def startup() -> None:
    initialize_database()
    initialize_budgets()
    initialize_tickets()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "agent_mode": extractor.mode}


@app.post("/api/agent/interpret", response_model=InterpretResponse)
def interpret_expense(payload: InterpretRequest) -> InterpretResponse:
    try:
        draft = extractor.extract(payload.message)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return InterpretResponse(
        draft=draft,
        mode=extractor.mode,
        validation_errors=validate_expense(draft),
    )


@app.post("/api/transactions/confirm", response_model=ConfirmExpenseResponse)
def confirm_expense(payload: ConfirmExpenseRequest) -> ConfirmExpenseResponse:
    if not payload.confirmed:
        raise HTTPException(status_code=400, detail="La operación no fue confirmada.")
    errors = validate_expense(payload.draft)
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})
    transaction_id = register_expense(payload.draft)
    return ConfirmExpenseResponse(
        transaction_id=transaction_id,
        message="Gasto registrado correctamente.",
    )


@app.get("/api/transactions")
def transactions() -> list[dict]:
    return list_expenses()


@app.get("/api/summary", response_model=SummaryResponse)
def summary() -> SummaryResponse:
    expenses = total_expenses()
    transactions = list_expenses()
    demo_income = 1000.0
    return SummaryResponse(
        income=demo_income,
        expenses=expenses,
        balance=demo_income - expenses,
        transaction_count=len(transactions),
    )


@app.post("/api/budgets", response_model=BudgetResponse)
def create_or_update_budget(payload: BudgetRequest) -> BudgetResponse:
    budget_id = save_budget(
        payload.category, payload.month, payload.amount_limit, payload.threshold_pct
    )
    return BudgetResponse(id=budget_id, message="Presupuesto guardado correctamente.")


@app.get("/api/budgets")
def budgets(month: str | None = None) -> list[dict]:
    return list_budgets(month)


@app.delete("/api/budgets/{budget_id}")
def remove_budget(budget_id: int) -> dict:
    if not delete_budget(budget_id):
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado.")
    return {"message": "Presupuesto eliminado correctamente."}


@app.post("/api/support")
def support(payload: SupportRequest) -> dict:
    return answer_support(payload.message)


@app.post("/api/tickets")
def ticket(payload: TicketRequest) -> dict:
    if not payload.confirmed:
        raise HTTPException(status_code=400, detail="Debes confirmar antes de crear el ticket.")
    return create_ticket(payload.case_type, payload.summary, payload.history, payload.priority)


@app.get("/api/tickets")
def tickets() -> list[dict]:
    return list_tickets()


@app.patch("/api/tickets/{ticket_id}/status")
def change_ticket_status(ticket_id: int, payload: TicketStatusRequest) -> dict:
    try:
        updated = update_ticket_status(ticket_id, payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="Ticket no encontrado.")
    return updated
