"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types";
import { Icon, LoaderDots } from "./Icons";

interface Props {
  history: ChatMessage[];
  loading: boolean;
  onSend: (msg: string) => void;
}

export function ChatBar({ history, loading, onSend }: Props) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "12px 18px",
        flexShrink: 0,
      }}
    >
      {history.length > 0 && (
        <div
          style={{
            maxHeight: 140,
            overflowY: "auto",
            marginBottom: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {history.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "72%",
                  padding: "7px 11px",
                  borderRadius: 9,
                  fontSize: 13,
                  lineHeight: 1.5,
                  background:
                    msg.role === "user" ? "var(--accent)" : "var(--bg)",
                  color: msg.role === "user" ? "#fff" : "var(--text)",
                  border:
                    msg.role === "assistant"
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex" }}>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 9,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                }}
              >
                <LoaderDots />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Iterate on the results… e.g. Make questions harder, add 5 more, translate to English"
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            fontSize: 13,
            fontFamily: "var(--font)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            background: "var(--accent)",
            border: "none",
            color: "#fff",
            cursor: input.trim() ? "pointer" : "not-allowed",
            opacity: input.trim() ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            transition: "opacity .15s",
          }}
        >
          <Icon name="send" size={14} />
        </button>
      </form>
    </div>
  );
}
