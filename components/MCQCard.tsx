"use client";

import { useState } from "react";
import type { MCQ, MCQLabel } from "@/types";
import { Icon } from "./Icons";

interface Props {
  item: MCQ;
  index: number;
  revealed: boolean;
  onReveal: (id: string) => void;
}

export function MCQCard({ item, index, revealed, onReveal }: Props) {
  const [selected, setSelected] = useState<Set<MCQLabel>>(new Set());

  const toggle = (label: MCQLabel) => {
    if (revealed) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleCheck = () => {
    if (revealed) return;
    onReveal(item.id);
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "20px 22px",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 14,
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--accent)",
            background: "var(--accent-light)",
            border: "1px solid var(--accent-border)",
            borderRadius: 5,
            padding: "2px 7px",
            marginTop: 1,
            flexShrink: 0,
            fontFamily: "var(--mono)",
            letterSpacing: "0.05em",
          }}
        >
          Q{index + 1}
        </span>
        <p
          style={{
            fontWeight: 500,
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--text)",
          }}
        >
          {item.question}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {item.options.map((opt) => {
          const isSelected = selected.has(opt.label);
          const showResult = revealed;

          let bg = "#F7F6F3";
          let border = "var(--border)";
          let color = "var(--text)";

          if (showResult) {
            if (opt.is_correct) {
              bg = "var(--green-light)";
              border = "var(--green)";
              color = "var(--green)";
            } else if (isSelected && !opt.is_correct) {
              bg = "var(--red-light)";
              border = "var(--red)";
              color = "var(--red)";
            }
          } else if (isSelected) {
            bg = "var(--accent-light)";
            border = "var(--accent)";
            color = "var(--accent)";
          }

          return (
            <div key={opt.label}>
              <button
                onClick={() => toggle(opt.label)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "9px 12px",
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: 7,
                  cursor: revealed ? "default" : "pointer",
                  color,
                  fontFamily: "var(--font)",
                  fontSize: 13.5,
                  textAlign: "left",
                  transition: "all .15s ease",
                  fontWeight: showResult && opt.is_correct ? 500 : 400,
                  width: "100%",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: `1.5px solid ${border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 1,
                    color,
                    background:
                      isSelected || (showResult && opt.is_correct)
                        ? border
                        : "transparent",
                  }}
                >
                  {showResult && opt.is_correct ? (
                    <Icon name="check" size={11} />
                  ) : showResult && isSelected && !opt.is_correct ? (
                    <Icon name="x" size={11} />
                  ) : (
                    opt.label
                  )}
                </span>
                <span style={{ flex: 1 }}>{opt.text}</span>
              </button>
              {revealed && (
                <div
                  style={{
                    margin: "6px 0 4px 30px",
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: "var(--text-muted)",
                  }}
                >
                  <strong
                    style={{
                      color: opt.is_correct ? "var(--green)" : "var(--red)",
                      fontWeight: 600,
                    }}
                  >
                    {opt.label}.
                  </strong>{" "}
                  {opt.justification}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!revealed && (
        <button
          onClick={handleCheck}
          disabled={selected.size === 0}
          style={{
            marginTop: 14,
            padding: "8px 16px",
            borderRadius: 7,
            background: selected.size === 0 ? "var(--border)" : "var(--accent)",
            color: selected.size === 0 ? "var(--text-muted)" : "#fff",
            border: "none",
            fontFamily: "var(--font)",
            fontSize: 13,
            fontWeight: 500,
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
            transition: "all .15s ease",
          }}
        >
          Vérifier les réponses
        </button>
      )}
    </div>
  );
}
