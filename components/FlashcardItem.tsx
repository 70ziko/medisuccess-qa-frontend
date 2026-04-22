"use client";

import { useState } from "react";
import type { Flashcard } from "@/types";
import { Icon } from "./Icons";

interface Props {
  item: Flashcard;
  index: number;
}

export function FlashcardItem({ item, index }: Props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      onClick={() => setFlipped((f) => !f)}
      style={{
        perspective: "1200px",
        cursor: "pointer",
        marginBottom: 10,
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform .45s cubic-bezier(.4,0,.2,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          minHeight: 110,
        }}
      >
        {/* Front */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            backfaceVisibility: "hidden",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            minHeight: 110,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              fontFamily: "var(--mono)",
              flexShrink: 0,
            }}
          >
            #{String(index + 1).padStart(2, "0")}
          </span>
          <p
            style={{
              fontWeight: 500,
              fontSize: 14,
              lineHeight: 1.5,
              flex: 1,
              color: "var(--text)",
            }}
          >
            {item.front}
          </p>
          <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
            <Icon name="flip" size={14} />
          </span>
        </div>

        {/* Back */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "var(--accent-light)",
            border: "1px solid var(--accent-border)",
            borderRadius: "var(--radius)",
            padding: "18px 20px",
            minHeight: 110,
          }}
        >
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "var(--text)",
              whiteSpace: "pre-line",
            }}
          >
            {item.back}
          </p>
        </div>
      </div>
    </div>
  );
}
