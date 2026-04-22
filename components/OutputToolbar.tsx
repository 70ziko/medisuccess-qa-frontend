"use client";

import { useState } from "react";
import type { MCQ, Flashcard } from "@/types";
import { Icon, IconBtn, Pill } from "./Icons";
import { downloadMarkdown, generateMarkdown } from "@/lib/qa-api";

interface Props {
  activeTab: "mcq" | "flashcards";
  onTabChange: (t: "mcq" | "flashcards") => void;
  mcqs: MCQ[];
  flashcards: Flashcard[];
  revealedCount: number;
  topic: string;
  onClear: () => void;
}

export function OutputToolbar({
  activeTab,
  onTabChange,
  mcqs,
  flashcards,
  revealedCount,
  topic,
  onClear,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const md = generateMarkdown(mcqs, flashcards);
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
              background: activeTab === id ? "var(--surface)" : "transparent",
              color: activeTab === id ? "var(--text)" : "var(--text-muted)",
              boxShadow:
                activeTab === id ? "0 1px 3px rgba(0,0,0,.07)" : "none",
              cursor: "pointer",
              fontFamily: "var(--font)",
              transition: "all .15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginLeft: 6 }}>
        <Pill color="accent">{mcqs.length} questions</Pill>
        <Pill color="green">{flashcards.length} cards</Pill>
        {revealedCount > 0 && (
          <Pill color="muted">
            {revealedCount}/{mcqs.length} revealed
          </Pill>
        )}
      </div>

      {/* Actions */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <IconBtn onClick={onClear} title="Clear">
          <Icon name="refresh" size={14} />
        </IconBtn>
        <IconBtn onClick={handleCopy} title="Copy markdown">
          {copied ? (
            <Icon name="check" size={14} />
          ) : (
            <Icon name="copy" size={14} />
          )}
        </IconBtn>
        <IconBtn
          onClick={() => downloadMarkdown(mcqs, flashcards, topic)}
          title="Download markdown"
        >
          <Icon name="download" size={14} />
        </IconBtn>
      </div>
    </div>
  );
}
