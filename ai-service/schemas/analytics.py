from pydantic import BaseModel, Field


class TransactionPoint(BaseModel):
    amount: float
    category: str | None = None
    occurred_at: str


class AnalyticsRequest(BaseModel):
    current_balance: float = Field(..., ge=0)
    monthly_income: float = Field(..., ge=0)
    monthly_spending: float = Field(..., ge=0)
    transactions: list[TransactionPoint] = Field(default_factory=list)


class ChatRequest(AnalyticsRequest):
    question: str
