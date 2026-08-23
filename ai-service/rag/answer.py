import json
import os

import httpx
from anthropic import Anthropic

from rag.search import Source, search_docs, SearchResult
from schemas.rag import RagRequest, RagResponse, SourceOut, ToolTraceEntry

MAX_TOOL_ITERS = 8

_SYSTEM_PROMPT = (
    "You are WealthLens, a personal-finance advisor for the signed-in user. "
    "Use searchDocs for concepts, rules, and how-to guidance. Use the personal-data "
    "tools for anything about the user's own money. Cite domain claims with [1], [2] "
    "markers matching the retrieved documents in order. Never cite personal-data tools. "
    "If a personal tool returns no data, say so plainly and suggest connecting Plaid. "
    "Never invent numbers. Keep answers under 200 words unless the user asks for detail."
)

_TOOLS = [
    {
        "name": "searchDocs",
        "description": (
            "Search the WealthLens knowledge base of consumer-finance articles "
            "for concepts, definitions, rules of thumb, or how-to guidance."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "k": {"type": "integer", "default": 6, "minimum": 1, "maximum": 12},
            },
            "required": ["query"],
        },
    },
]


def _client() -> Anthropic:
    return Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def _to_anthropic_messages(history) -> list[dict]:
    return [{"role": t.role, "content": t.message} for t in history]


def _search_result_content(tool_use_id: str, result: SearchResult, start_n: int) -> dict:
    payload = {
        "results": [
            {"n": start_n + i, "title": h.title, "publisher": h.publisher,
             "url": h.url, "text": h.text}
            for i, h in enumerate(result.hits)
        ]
    }
    return {"type": "tool_result", "tool_use_id": tool_use_id, "content": json.dumps(payload)}


def _backend_tool_content(tool_use_id: str, data) -> dict:
    return {"type": "tool_result", "tool_use_id": tool_use_id, "content": json.dumps({"data": data})}


def _call_backend_tool(name: str, args: dict, user_id: str, tool_jwt: str) -> dict:
    url = os.environ["BACKEND_URL"].rstrip("/") + "/internal/advisor/tool"
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            url,
            headers={"authorization": f"Bearer {tool_jwt}"},
            json={"tool": name, "args": args, "userId": user_id},
        )
        resp.raise_for_status()
        payload = resp.json()
    return payload.get("data") if "data" in payload else {"error": payload.get("error", "unknown")}


def answer_question(req: RagRequest, tool_jwt: str) -> RagResponse:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return RagResponse(answer="Advisor not configured. Ask an operator to set ANTHROPIC_API_KEY.")

    messages = _to_anthropic_messages(req.history) + [{"role": "user", "content": req.question}]
    sources: list[Source] = []
    trace: list[ToolTraceEntry] = []
    client = _client()
    resp = None

    for _ in range(MAX_TOOL_ITERS):
        resp = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            tools=_TOOLS,
            messages=messages,
        )
        if resp.stop_reason != "tool_use":
            break

        tool_results = []
        for block in resp.content:
            if getattr(block, "type", None) != "tool_use":
                continue
            trace.append(ToolTraceEntry(name=block.name, input=dict(block.input)))
            if block.name == "searchDocs":
                result = search_docs(block.input["query"], k=int(block.input.get("k", 6)))
                new_sources = result.to_sources(start_n=len(sources) + 1)
                sources.extend(new_sources)
                tool_results.append(
                    _search_result_content(block.id, result, start_n=len(sources) - len(new_sources) + 1)
                )
            else:
                data = _call_backend_tool(block.name, dict(block.input),
                                           req.toolContext.userId, tool_jwt)
                tool_results.append(_backend_tool_content(block.id, data))

        messages.append({"role": "assistant", "content": resp.content})
        messages.append({"role": "user", "content": tool_results})

    answer_text = ""
    if resp is not None:
        answer_text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")

    return RagResponse(
        answer=answer_text or "I couldn't put together an answer this time.",
        sources=[SourceOut(**s.__dict__) for s in sources],
        toolTrace=trace,
    )
