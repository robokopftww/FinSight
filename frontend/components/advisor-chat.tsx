"use client";

import { useAuth } from "@clerk/nextjs";
import { Bot, Clock3, Loader2, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

type AdvisorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  decision?: string;
  dataPoints?: Array<{ label: string; value: string }>;
  source?: string;
  createdAt?: string;
};

type HistoryResponse = {
  data: AdvisorMessage[];
};

const welcomeMessage: AdvisorMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Ask me about affordability, spending spikes, savings goals, or cash-flow risk. I will answer from your synced Plaid transactions and WealthLens forecast.",
  decision: "ready",
};

const starterPrompts = [
  "Can I afford a $400 purchase?",
  "I want to save $5,000 by December",
  "Why did I spend so much this month?",
  "What is my biggest cash flow risk?",
];

export function AdvisorChat({ compact = false }: { compact?: boolean }) {
  const { getToken, isSignedIn } = useAuth();
  const [messages, setMessages] = useState<AdvisorMessage[]>([welcomeMessage]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!apiBaseUrl || !isSignedIn) {
      setIsLoadingHistory(false);
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/advisor/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error("History request failed.");
      }

      const data = (await response.json()) as HistoryResponse;
      setMessages(data.data.length ? data.data : [welcomeMessage]);
      setHistoryMessage(data.data.length ? `Restored ${data.data.length} saved messages.` : null);
    } catch {
      setMessages([welcomeMessage]);
      setHistoryMessage("Could not load saved advisor history.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadHistory]);

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
        source?: string;
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          decision: data.decision,
          dataPoints: data.dataPoints,
          source: data.source,
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

  async function clearHistory() {
    if (!apiBaseUrl || isSending || isLoadingHistory) {
      return;
    }

    if (!window.confirm("Clear saved advisor chat history for this account?")) {
      return;
    }

    setIsLoadingHistory(true);

    try {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/advisor/history`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error("Clear history request failed.");
      }

      setMessages([welcomeMessage]);
      setHistoryMessage("Advisor history cleared.");
    } catch {
      setHistoryMessage("Could not clear advisor history.");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  return (
    <div className={compact ? "flex min-h-0 flex-1 flex-col" : "grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]"}>
      <section className={compact ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-surface)]" : "overflow-hidden rounded-[28px] border border-slate-200 bg-[var(--color-surface)]"}>
        {!compact ? <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-slate-950">Financial advisor</h2>
              <p className="text-sm text-slate-500">Grounded in synced balances, spending, and forecasts.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingHistory ? <Loader2 className="size-4 animate-spin text-slate-500" /> : null}
            <span className="hidden rounded-full bg-[var(--color-accent-soft-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-text)] sm:inline-flex">
              Gemini + Python
            </span>
          </div>
        </div> : null}

        {compact ? (
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 transition hover:border-[var(--color-accent)] hover:text-slate-950"
                  onClick={() => void sendQuestion(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-amber-300/30 hover:bg-amber-300/10 hover:text-amber-700 disabled:opacity-50"
              onClick={() => void clearHistory()}
              disabled={isSending || isLoadingHistory}
              aria-label="Clear advisor history"
              title="Clear advisor history"
            >
              {isLoadingHistory ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          </div>
        ) : null}

        <div className={compact ? "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" : "max-h-[34rem] space-y-4 overflow-y-auto px-5 py-5"}>
          {historyMessage ? (
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Clock3 className="size-3.5" />
              {historyMessage}
            </div>
          ) : null}
          {messages.map((message) => {
            const isAssistant = message.role === "assistant";

            return (
              <div key={message.id} className={`flex gap-3 ${isAssistant ? "" : "justify-end"}`}>
                {isAssistant ? (
                  <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600/16 text-[var(--color-accent-text)]">
                    <Bot className="size-4" />
                  </span>
                ) : null}
                <div
                  className={
                    isAssistant
                      ? `${compact ? "max-w-[85%]" : "max-w-2xl"} rounded-[24px] border border-slate-200 bg-slate-100 px-5 py-4 text-sm leading-7 text-slate-800`
                      : `${compact ? "max-w-[85%]" : "max-w-2xl"} rounded-[24px] bg-blue-600 px-5 py-4 text-sm leading-7 text-white`
                  }
                >
                  <p>{message.content}</p>
                  {message.dataPoints?.length ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {message.dataPoints.map((point) => (
                        <div key={point.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{point.label}</div>
                          <div className="mt-1 font-semibold text-slate-950">{point.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {isAssistant && message.source ? (
                    <div className="mt-4 inline-flex rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-text)]">
                      {formatSourceLabel(message.source)}
                    </div>
                  ) : null}
                </div>
                {!isAssistant ? (
                  <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-950">
                    <UserRound className="size-4" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4">
          <div className={compact
            ? "flex items-center gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2"
            : "flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-2 sm:flex-row"
          }>
            <input
              className="min-h-12 flex-1 bg-transparent px-4 text-sm text-slate-950 outline-none placeholder:text-slate-500"
              aria-label="Advisor question"
              placeholder={compact ? "Ask about your finances…" : "Ask if a purchase is safe, why spending changed, or how to save more"}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <Button
              type="submit"
              disabled={isSending || !question.trim()}
              className={compact ? "size-11 shrink-0 p-0" : "gap-2"}
            >
              <Send className="size-4" />
              <span className={compact ? "sr-only" : ""}>{isSending ? "Thinking" : "Send"}</span>
            </Button>
          </div>
        </form>
      </section>

      {!compact ? <aside className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-950">Try asking</h2>
            <button
              type="button"
              className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-amber-300/30 hover:bg-amber-300/10 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void clearHistory()}
              disabled={isSending || isLoadingHistory}
              aria-label="Clear advisor history"
              title="Clear advisor history"
            >
              {isLoadingHistory ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm leading-6 text-slate-700 transition hover:border-[var(--color-accent)] hover:text-slate-950"
                onClick={() => void sendQuestion(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-text)]">Context sources</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <p>Synced account balances</p>
            <p>Recent Plaid transactions</p>
            <p>Subscription estimates</p>
            <p>Python forecast and score</p>
            <p>Gemini explanation layer</p>
          </div>
        </div>
      </aside> : null}
    </div>
  );
}

function formatSourceLabel(source: string) {
  if (source.startsWith("gemini")) {
    return "Gemini + Python analytics";
  }

  if (source.startsWith("typescript")) {
    return "Local fallback";
  }

  return "Python analytics";
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
