"use client";

import type { TokenUsage } from "@/types";

const STAGE_LABELS: Record<string, string> = {
  flashcards: "Flashcards",
  mcq_generation: "MCQ Generation",
  mcq_validation: "MCQ Validation",
  hq_generation: "HQ Generation",
  hq_validation: "HQ Validation",
  trial_generation: "Trial Generation",
  trial_validation: "Trial Validation",
  qcu_generation: "QCU Generation",
  qcu_validation: "QCU Validation",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface Props {
  usage: TokenUsage;
  onClose: () => void;
}

export function TokenUsagePanel({ usage, onClose }: Props) {
  const stageEntries = Object.entries(usage.stages);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          top: 56,
          right: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 8px 28px rgba(0,0,0,.13)",
          width: 300,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "11px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}
          >
            Token Usage
          </span>
          <button
            onClick={onClose}
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 15,
              fontFamily: "var(--font)",
            }}
          >
            ×
          </button>
        </div>

        {/* Stage rows */}
        <div style={{ padding: "8px 0" }}>
          {stageEntries.length === 0 ? (
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                padding: "6px 14px",
              }}
            >
              No data
            </p>
          ) : (
            stageEntries.map(([stage, tokens]) => (
              <div
                key={stage}
                style={{
                  padding: "5px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {STAGE_LABELS[stage] ?? stage}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    fontFamily: "var(--mono)",
                    whiteSpace: "nowrap",
                  }}
                  title={`↑${tokens.input.toLocaleString()} in  ↓${tokens.output.toLocaleString()} out`}
                >
                  ↑{fmt(tokens.input)} ↓{fmt(tokens.output)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text)",
                    fontFamily: "var(--mono)",
                    minWidth: 44,
                    textAlign: "right",
                  }}
                >
                  {fmt(tokens.total)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Total */}
        <div
          style={{
            padding: "9px 14px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
            Total
          </span>
          <div
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <span
              style={{
                fontSize: 11.5,
                color: "var(--text-muted)",
                fontFamily: "var(--mono)",
              }}
              title={`↑${usage.total.input.toLocaleString()} in  ↓${usage.total.output.toLocaleString()} out`}
            >
              ↑{fmt(usage.total.input)} ↓{fmt(usage.total.output)}
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--accent)",
                fontFamily: "var(--mono)",
              }}
            >
              {fmt(usage.total.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
