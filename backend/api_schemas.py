from pydantic import BaseModel, Field

from agent.schemas import ExpenseDraft


class InterpretRequest(BaseModel):
    message: str = Field(min_length=2, max_length=500)


class InterpretResponse(BaseModel):
    draft: ExpenseDraft
    mode: str
    validation_errors: list[str]


class ConfirmExpenseRequest(BaseModel):
    draft: ExpenseDraft
    confirmed: bool


class ConfirmExpenseResponse(BaseModel):
    transaction_id: int
    message: str


class SummaryResponse(BaseModel):
    income: float
    expenses: float
    balance: float
    transaction_count: int


class IncomeRequest(BaseModel):
    amount: float = Field(ge=0, le=100000000)


class BudgetRequest(BaseModel):
    category: str
    month: str = Field(pattern=r"^\d{4}-\d{2}$")
    amount_limit: float = Field(gt=0)
    threshold_pct: int = Field(ge=50, le=100)


class BudgetResponse(BaseModel):
    id: int
    message: str


class SupportRequest(BaseModel):
    message: str = Field(min_length=3, max_length=1000)


class TicketRequest(BaseModel):
    case_type: str
    summary: str = Field(min_length=3)
    history: str = Field(min_length=3)
    priority: str
    confirmed: bool


class TicketStatusRequest(BaseModel):
    status: str = Field(pattern=r"^(ESCALATED|IN_REVIEW|CLOSED)$")
