from fastapi import APIRouter, Header, HTTPException

from rag.answer import answer_question
from schemas.rag import RagRequest, RagResponse

router = APIRouter()


@router.post("/rag/answer", response_model=RagResponse)
def rag_answer(req: RagRequest, x_tool_jwt: str = Header(default="")) -> RagResponse:
    if not x_tool_jwt:
        raise HTTPException(status_code=401, detail="missing x-tool-jwt")
    return answer_question(req, tool_jwt=x_tool_jwt)
