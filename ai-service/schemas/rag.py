from pydantic import BaseModel


class HistoryTurn(BaseModel):
    role: str
    message: str


class ToolContext(BaseModel):
    userId: str
    plaidReady: bool
    now: str


class RagRequest(BaseModel):
    question: str
    toolContext: ToolContext
    history: list[HistoryTurn] = []


class SourceOut(BaseModel):
    n: int
    title: str
    publisher: str
    url: str
    snippet: str


class ToolTraceEntry(BaseModel):
    name: str
    input: dict


class RagResponse(BaseModel):
    answer: str
    sources: list[SourceOut] = []
    toolTrace: list[ToolTraceEntry] = []
