"use client";

import { useState } from "react";
import type { DiagramChatTurn, DiagramEntry } from "@/types";
import { Icon, LoaderDots } from "./Icons";

const ENTRY_LABEL: Record<DiagramEntry, string> = {
  answer: "No change",
  legend: "Legend only",
  redraw: "Redraw notes",
  number: "Restarted from the numbering",
  read: "Read the texts again",
  orient: "Full run",
};

const EXAMPLES =
  "e.g. “number the captions in the inset too”, “add Haut/Bas arrows in a corner”, “expand the abbreviations in the legend”";

/** Staff chat on one drawing: each message re-runs only the steps it needs. */
export function DiagramChat({
  turns,
  busy,
  disabled,
  onSend,
}: {
  turns: DiagramChatTurn[];
  /** A run of this diagram is queued or in progress. */
  busy: boolean;
  /** No result the server can restart from. */
  disabled?: boolean;
  onSend: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const canSend = input.trim().length > 0 && !busy && !disabled;
  const waiting = busy && turns.length > 0 && turns[turns.length - 1].role === "user";

  const send = () => {
    if (!canSend) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Ask for changes
      </div>

      {turns.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
          {turns.map((t, i) => (
            <div
              key={i}
              style={{
                alignSelf: t.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 12.5,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                background: t.role === "user" ? "var(--accent-light)" : "var(--bg)",
                border: `1px solid ${t.role === "user" ? "var(--accent-border)" : "var(--border)"}`,
              }}
            >
              {t.text}
              {t.entry && (
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-muted)", marginTop: 3 }}>
                  {ENTRY_LABEL[t.entry]}
                </div>
              )}
            </div>
          ))}
          {waiting && (
            <div style={{ alignSelf: "flex-start", padding: "4px 2px" }}>
              <LoaderDots />
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={disabled ? "Available once the diagram has a result" : EXAMPLES}
          disabled={disabled}
          aria-label="Message about this diagram"
          style={{
            flex: 1,
            minWidth: 0,
            resize: "vertical",
            padding: "7px 10px",
            borderRadius: 7,
            border: "1px solid var(--border)",
            background: "#FAFAF8",
            fontSize: 12.5,
            fontFamily: "var(--font)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          title={busy ? "Wait for the current run to finish" : "Send"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 7,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 500,
            fontFamily: "var(--font)",
            cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend ? 1 : 0.5,
          }}
        >
          <Icon name="send" size={12} /> Send
        </button>
      </div>
    </div>
  );
}
