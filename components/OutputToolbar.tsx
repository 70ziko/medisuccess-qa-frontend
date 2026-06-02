"use client";

import { useState } from "react";
import type { MCQ, Flashcard, Tab, TokenUsage } from "@/types";
import { Icon, IconBtn, LoaderDots, Pill } from "./Icons";
import { downloadTabMarkdown, tabMarkdown } from "@/lib/qa-api";

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface Props {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  loadingTabs: Record<Tab, boolean>;
  /** MCQ list backing the active tab (variant tabs have their own list). */
  activeMcqs: MCQ[];
  flashcards: Flashcard[];
  revealedCount: number;
  topic: string;
  onClear: () => void;
  /** Re-run generation for the active tab (variant tabs only). */
  onRegenerate?: () => void;
  regenerating?: boolean;
  tokenUsage?: TokenUsage | null;
  onToggleTokens?: () => void;
}

export function OutputToolbar({
  activeTab,
  onTabChange,
  loadingTabs,
  activeMcqs,
  flashcards,
  revealedCount,
  topic,
  onClear,
  onRegenerate,
  regenerating,
  tokenUsage,
  onToggleTokens,
}: Props) {
  const [copied, setCopied] = useState(false);
  const isFlashcards = activeTab === "flashcards";

  const TAB_COLORS: Record<string, { bg: string; text: string }> = {
    flashcards: { bg: "#dbeafe", text: "#1d4ed8" },
    mcq:        { bg: "#ffedd5", text: "#c2410c" },
    hq:         { bg: "#ede9fe", text: "#6d28d9" },
    trial:      { bg: "#dcfce7", text: "#15803d" },
    qcu:        { bg: "#fce7f3", text: "#be185d" },
  };

  const handleCopy = () => {
    const md = tabMarkdown(activeTab, activeMcqs, flashcards);
    navigator.clipboard.writeText(md).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        padding: "12px 22px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--surface)",
        flexShrink: 0,
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          background: "var(--bg)",
          borderRadius: 8,
          padding: 3,
        }}
      >
        {(
          [
            ["mcq",        "MCQ"],
            ["flashcards", "Flashcards"],
            ["hq",         "MCQ – HQ"],
            ["trial",      "Trial"],
            ["qcu",        "QCU"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: "none",
              fontSize: 13,
              fontWeight: 500,
              background:
                activeTab === id
                  ? TAB_COLORS[id]?.bg ?? "var(--surface)"
                  : "transparent",
              color:
                activeTab === id
                  ? TAB_COLORS[id]?.text ?? "var(--text)"
                  : "var(--text-muted)",
              boxShadow:
                activeTab === id ? "0 1px 3px rgba(0,0,0,.10)" : "none",
              cursor: "pointer",
              fontFamily: "var(--font)",
              transition: "all .15s",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {label}
            {loadingTabs[id] && <LoaderDots />}
          </button>
        ))}
      </div>

      {/* Stats — scoped to the active tab */}
      <div style={{ display: "flex", gap: 8, marginLeft: 6 }}>
        {isFlashcards ? (
          <Pill color="green">{flashcards.length} cards</Pill>
        ) : (
          <>
            <Pill color="accent">{activeMcqs.length} questions</Pill>
            {revealedCount > 0 && (
              <Pill color="muted">
                {revealedCount}/{activeMcqs.length} revealed
              </Pill>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        {tokenUsage && onToggleTokens && (
          <button
            onClick={onToggleTokens}
            title={`Token usage · est. $${tokenUsage.total.cost.toFixed(4)}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 9px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 11.5,
              fontFamily: "var(--mono)",
              fontWeight: 500,
              whiteSpace: "nowrap",
              transition: "all .15s",
            }}
          >
            <Icon name="zap" size={12} />
            {fmtTokens(tokenUsage.total.total)}
          </button>
        )}
        {onRegenerate && (
          <IconBtn
            onClick={() => {
              if (!regenerating) onRegenerate();
            }}
            title="Regenerate this tab with the current count"
          >
            {regenerating ? <LoaderDots /> : <Icon name="sparkle" size={14} />}
          </IconBtn>
        )}
        <IconBtn onClick={onClear} title="Clear all">
          <Icon name="refresh" size={14} />
        </IconBtn>
        <IconBtn onClick={handleCopy} title="Copy this tab as markdown">
          {copied ? (
            <Icon name="check" size={14} />
          ) : (
            <Icon name="copy" size={14} />
          )}
        </IconBtn>
        <IconBtn
          onClick={() =>
            downloadTabMarkdown(activeTab, activeMcqs, flashcards, topic)
          }
          title="Download this tab as markdown"
        >
          <Icon name="download" size={14} />
        </IconBtn>
      </div>
    </div>
  );
}
