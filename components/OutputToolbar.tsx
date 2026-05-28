"use client";

import { useState } from "react";
import type { MCQ, Flashcard, Tab } from "@/types";
import { Icon, IconBtn, LoaderDots, Pill } from "./Icons";
import { downloadTabMarkdown, tabMarkdown } from "@/lib/qa-api";

interface Props {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  /** MCQ list backing the active tab (variant tabs have their own list). */
  activeMcqs: MCQ[];
  flashcards: Flashcard[];
  revealedCount: number;
  topic: string;
  onClear: () => void;
  /** Re-run generation for the active tab (variant tabs only). */
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export function OutputToolbar({
  activeTab,
  onTabChange,
  activeMcqs,
  flashcards,
  revealedCount,
  topic,
  onClear,
  onRegenerate,
  regenerating,
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
            ["mcq", "MCQ"],
            ["flashcards", "Flashcards"],
            ["hq", "MCQ – HQ"],
            ["trial", "Trial"],
            ["qcu", "QCU"],
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
            }}
          >
            {label}
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

      {/* Actions — operate on the active tab */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
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
