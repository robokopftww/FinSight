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
const BOLD_RE = /\*\*([^*]+)\*\*/g;

type BlockKind = "paragraph" | "heading" | "ordered" | "unordered";

type Block = { kind: BlockKind; level?: number; number?: string; text: string };

function parseBlocks(content: string): Block[] {
  const lines = content.split(/\r?\n/);
  const blocks: Block[] = [];
  let buffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(" ").trim();
    if (text) blocks.push({ kind: "paragraph", text });
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }
    const ordered = line.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      blocks.push({ kind: "ordered", number: ordered[1], text: ordered[2] });
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.*)$/);
    if (unordered) {
      flushParagraph();
      blocks.push({ kind: "unordered", text: unordered[1] });
      continue;
    }
    buffer.push(line);
  }
  flushParagraph();
  return blocks;
}

function renderInline(
  text: string,
  onCitationClick: (n: number) => void,
  keyPrefix: string,
): React.ReactNode[] {
  const withBold: Array<string | React.JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BOLD_RE.lastIndex = 0;
  while ((match = BOLD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) withBold.push(text.slice(lastIndex, match.index));
    withBold.push(
      <strong key={`${keyPrefix}-b-${match.index}`} className="font-semibold text-slate-950">
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) withBold.push(text.slice(lastIndex));

  const withCitations: React.ReactNode[] = [];
  withBold.forEach((chunk, idx) => {
    if (typeof chunk !== "string") {
      withCitations.push(<Fragment key={`${keyPrefix}-w-${idx}`}>{chunk}</Fragment>);
      return;
    }
    let cursor = 0;
    let m: RegExpExecArray | null;
    CITATION_RE.lastIndex = 0;
    while ((m = CITATION_RE.exec(chunk)) !== null) {
      if (m.index > cursor) {
        withCitations.push(
          <Fragment key={`${keyPrefix}-t-${idx}-${cursor}`}>{chunk.slice(cursor, m.index)}</Fragment>,
        );
      }
      const n = Number(m[1]);
      withCitations.push(
        <sup key={`${keyPrefix}-c-${idx}-${m.index}`} className="mx-0.5 text-[10px]">
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
      cursor = m.index + m[0].length;
    }
    if (cursor < chunk.length) {
      withCitations.push(
        <Fragment key={`${keyPrefix}-t-${idx}-end`}>{chunk.slice(cursor)}</Fragment>,
      );
    }
  });
  return withCitations;
}

function renderContent(content: string, onCitationClick: (n: number) => void) {
  const blocks = parseBlocks(content);
  return blocks.map((block, idx) => {
    const inline = renderInline(block.text, onCitationClick, `b${idx}`);
    if (block.kind === "heading") {
      const cls =
        block.level === 1
          ? "mt-4 text-base font-semibold text-slate-950 first:mt-0"
          : block.level === 2
            ? "mt-3 text-sm font-semibold text-slate-950 first:mt-0"
            : "mt-2 text-sm font-semibold text-slate-700 first:mt-0";
      return (
        <p key={idx} className={cls}>
          {inline}
        </p>
      );
    }
    if (block.kind === "ordered") {
      return (
        <div key={idx} className="mt-1 flex gap-2 first:mt-0">
          <span className="min-w-[1.25rem] pt-[1px] text-right font-mono text-xs text-slate-500 tabular-nums">
            {block.number}.
          </span>
          <p className="flex-1">{inline}</p>
        </div>
      );
    }
    if (block.kind === "unordered") {
      return (
        <div key={idx} className="mt-1 flex gap-2 first:mt-0">
          <span className="min-w-[0.75rem] pt-[1px] text-slate-500">•</span>
          <p className="flex-1">{inline}</p>
        </div>
      );
    }
    return (
      <p key={idx} className="mt-2 first:mt-0">
        {inline}
      </p>
    );
  });
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
