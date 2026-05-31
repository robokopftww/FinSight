from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class TransactionPoint(BaseModel):
    amount: float
    direction: Optional[str] = None
    category: Optional[str] = None
    merchant_name: Optional[str] = None
    description: Optional[str] = None
    occurred_at: str
    pending: bool = False


class AnalyticsRequest(BaseModel):
    current_balance: float
    monthly_income: float = Field(..., ge=0)
    monthly_spending: float = Field(..., ge=0)
    monthly_subscription_cost: float = Field(default=0, ge=0)
    transactions: List[TransactionPoint] = Field(default_factory=list)


class ChatRequest(AnalyticsRequest):
    question: str
