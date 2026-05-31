"use client";

import { useAuth } from "@clerk/nextjs";
import { Bot, Send, Sparkles, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

type AdvisorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  decision?: string;
  dataPoints?: Array<{ label: string; value: string }>;
};

const starterPrompts = [
  "Can I afford a $400 purchase?",
  "Why did I spend so much this month?",
  "How can I save more money?",
  "What is my biggest cash flow risk?",
];

export function AdvisorChat() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask me about affordability, spending spikes, savings plans, or cash-flow risk. I will answer from your synced Plaid transactions and FinSight forecast.",
      decision: "ready",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendQuestion(nextQuestion: string) {
    const trimmedQuestion = nextQuestion.trim();

    if (!trimmedQuestion || isSending) {
      return;
    }

    const userMessage: AdvisorMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: formatQuestionForDisplay(trimmedQuestion),
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setQuestion("");
    setIsSending(true);

    try {
      if (!apiBaseUrl) {
        throw new Error("API base URL missing.");
      }

      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/advisor/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: trimmedQuestion }),
      });

      if (!response.ok) {
        throw new Error("Advisor request failed.");
      }

      const data = (await response.json()) as {
        answer: string;
        decision?: string;
        dataPoints?: Array<{ label: string; value: string }>;
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          decision: data.decision,
          dataPoints: data.dataPoints,
        },
      ]);
    } catch {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I could not reach the advisor service. Make sure the backend and AI service are both running.",
          decision: "offline",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(question);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[#091120]">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-white">Financial advisor</h2>
              <p className="text-sm text-slate-400">Grounded in synced balances, spending, and forecasts.</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-300/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
            Python analytics
          </span>
        </div>

        <div className="max-h-[34rem] space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((message) => {
            const isAssistant = message.role === "assistant";

            return (
              <div key={message.id} className={`flex gap-3 ${isAssistant ? "" : "justify-end"}`}>
                {isAssistant ? (
                  <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/16 text-emerald-100">
                    <Bot className="size-4" />
                  </span>
                ) : null}
                <div
                  className={
                    isAssistant
                      ? "max-w-2xl rounded-[24px] border border-white/8 bg-white/6 px-5 py-4 text-sm leading-7 text-slate-100"
                      : "max-w-2xl rounded-[24px] bg-[var(--color-accent)] px-5 py-4 text-sm leading-7 text-slate-950"
                  }
                >
                  <p>{message.content}</p>
                  {message.dataPoints?.length ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {message.dataPoints.map((point) => (
                        <div key={point.label} className="rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{point.label}</div>
                          <div className="mt-1 font-semibold text-white">{point.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                {!isAssistant ? (
                  <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                    <UserRound className="size-4" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-white/8 p-4">
          <div className="flex flex-col gap-3 rounded-[24px] border border-white/8 bg-white/5 p-2 sm:flex-row">
            <input
              className="min-h-12 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-slate-500"
              placeholder="Ask if a purchase is safe, why spending changed, or how to save more"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <Button type="submit" disabled={isSending || !question.trim()} className="gap-2">
              <Send className="size-4" />
              {isSending ? "Thinking" : "Send"}
            </Button>
          </div>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="rounded-[28px] border border-white/8 bg-white/5 p-5">
          <h2 className="font-semibold text-white">Try asking</h2>
          <div className="mt-4 space-y-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="w-full rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left text-sm leading-6 text-slate-200 transition hover:border-[var(--color-accent)] hover:text-white"
                onClick={() => void sendQuestion(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-emerald-300/16 bg-emerald-300/8 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Context sources</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
            <p>Synced account balances</p>
            <p>Recent Plaid transactions</p>
            <p>Subscription estimates</p>
            <p>Python forecast and score</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function formatQuestionForDisplay(question: string) {
  return question.replace(
    /\$?\b([0-9]{4,})(?:\.([0-9]{1,2}))?\b(?:\s+dollars?)?/gi,
    (_match, dollars: string, cents?: string) => {
      const amount = Number(`${dollars}.${cents ?? "0"}`);

      if (!Number.isFinite(amount)) {
        return dollars;
      }

      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: cents ? 2 : 0,
      }).format(amount);
    },
  );
}
