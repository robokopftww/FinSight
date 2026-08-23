import os
import time

from schemas.rag import RagRequest, ToolContext
from rag.answer import answer_question

GOLDEN = [
    ("How big should my emergency fund be?", "domain"),
    ("What is credit utilization and why does it matter?", "domain"),
    ("What is the 50/30/20 budget?", "domain"),
    ("How do I open a Roth IRA?", "domain"),
    ("What is APR?", "domain"),
    ("What is a good FICO score?", "domain"),
    ("What did I spend on food last month?", "personal"),
    ("Which subscription is most expensive?", "personal"),
    ("Am I on track for a $5,000 savings goal by December?", "personal"),
    ("What's my biggest cash-flow risk?", "personal"),
]


def main() -> None:
    tool_jwt = os.getenv("EVAL_TOOL_JWT", "eval.stub")
    for question, kind in GOLDEN:
        req = RagRequest(
            question=question,
            toolContext=ToolContext(
                userId=os.getenv("EVAL_USER_ID", "u_eval"),
                plaidReady=kind == "personal",
                now=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            ),
            history=[],
        )
        try:
            resp = answer_question(req, tool_jwt=tool_jwt)
        except Exception as exc:  # pragma: no cover - eval-only
            print(f"[{kind}] {question}\n  ERROR: {exc}\n")
            continue
        print(f"[{kind}] {question}")
        print(f"  answer: {resp.answer[:200].replace(chr(10), ' ')}")
        for s in resp.sources:
            print(f"    [{s.n}] {s.publisher} {s.title[:60]} {s.url}")
        print()


if __name__ == "__main__":
    main()
