"use client";

import { useState } from "react";
import type { MCQ } from "@/types";
import { Icon } from "./Icons";

interface Props {
  item: MCQ;
  index: number;
  revealed: boolean;
  onReveal: (id: string) => void;
}

export function MCQCard({ item, index, revealed, onReveal }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (label: string) => {
    if (revealed) return;
    setSelected(label);
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
          const isCorrect = opt.label === item.correct_answer;
          const isSelected = opt.label === selected;
          const showResult = revealed && (isCorrect || isSelected);

          let bg = "#F7F6F3",
            border = "var(--border)",
            color = "var(--text)";
          if (showResult && isCorrect) {
            bg = "var(--green-light)";
            border = "var(--green)";
            color = "var(--green)";
          } else if (showResult && isSelected && !isCorrect) {
            bg = "var(--red-light)";
            border = "var(--red)";
            color = "var(--red)";
          } else if (!revealed && isSelected) {
            bg = "var(--accent-light)";
            border = "var(--accent)";
            color = "var(--accent)";
          }

          return (
            <button
              key={opt.label}
              onClick={() => handleSelect(opt.label)}
              style={{
                display: "flex",
                alignItems: "center",
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
                fontWeight: showResult && isCorrect ? 500 : 400,
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
                  color,
                  background:
                    isSelected || (showResult && isCorrect)
                      ? border
                      : "transparent",
                }}
              >
                {showResult && isCorrect ? (
                  <Icon name="check" size={11} />
                ) : showResult && isSelected ? (
                  <Icon name="x" size={11} />
                ) : (
                  opt.label
                )}
              </span>
              {opt.text}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#F7F6F3",
            borderRadius: 7,
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.55,
            borderLeft: "3px solid var(--border)",
          }}
        >
          <strong style={{ color: "var(--text)", fontWeight: 500 }}>
            Explication —{" "}
          </strong>
          {item.explanation}
          {item.source_reference && (
            <div
              style={{
                marginTop: 6,
                fontSize: 11.5,
                fontStyle: "italic",
                color: "var(--text-muted)",
              }}
            >
              {item.source_reference}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
