"use client";

import React, { Fragment, useCallback } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import type { AdvisorSource } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  content: string;
  sources?: AdvisorSource[];
};

const CITATION_RE = /\[(\d+)\]/g;

function renderContent(content: string, onCitationClick: (n: number) => void) {
  const nodes: Array<string | React.JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CITATION_RE.lastIndex = 0;
  while ((match = CITATION_RE.exec(content)) !== null) {
    if (match.index > lastIndex) nodes.push(content.slice(lastIndex, match.index));
    const n = Number(match[1]);
    nodes.push(
      <sup key={`c-${match.index}`} className="mx-0.5 text-[10px]">
        <a
          href={`#src-${n}`}
          onClick={(e) => {
            e.preventDefault();
            onCitationClick(n);
          }}
          className="rounded-sm bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-semibold text-[var(--color-accent-text)] hover:underline"
        >
          [{n}]
        </a>
      </sup>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) nodes.push(content.slice(lastIndex));
  return nodes.map((node, idx) => <Fragment key={idx}>{node}</Fragment>);
}

export function AdvisorMessage({ role, content, sources }: Props) {
  const handleClick = useCallback((n: number) => {
    if (typeof document === "undefined") return;
    const target = document.getElementById(`src-${n}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    target.classList.add("ring-2", "ring-[var(--color-accent-base)]/40");
    window.setTimeout(() => {
      target.classList.remove("ring-2", "ring-[var(--color-accent-base)]/40");
    }, 900);
  }, []);

  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-3 text-sm leading-6",
        role === "assistant"
          ? "border border-slate-200 bg-white"
          : "ml-auto bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]",
      )}
    >
      <div>{renderContent(content, handleClick)}</div>
      {sources && sources.length > 0 ? (
        <ol className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {sources.map((s) => (
            <li id={`src-${s.n}`} key={s.n} className="rounded-lg p-2 text-[12px] transition">
              <div className="flex items-center gap-2 text-slate-800">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                  [{s.n}]
                </span>
                <span className="font-semibold">{s.publisher}</span>
                <span className="truncate text-slate-500">{s.title}</span>
                <Link
                  aria-label={`Open source ${s.n}`}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-slate-500 hover:text-[var(--color-accent-text)]"
                >
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
              <p className="mt-1 text-slate-500">{s.snippet}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
