"use client";

import type { Tab, TokenUsage } from "@/types";
import { LoaderDots } from "./Icons";

// ── Constants ────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, string> = {
  mcq:        "MCQ",
  flashcards: "Flashcards",
  hq:         "MCQ – HQ",
  trial:      "Trial",
  qcu:        "QCU",
  exercise:   "Exercises",
};

const ALL_TABS: Tab[] = ["mcq", "flashcards", "hq", "trial", "qcu", "exercise"];

/** Stage keys that belong to each tab */
const TAB_STAGES: Record<Tab, string[]> = {
  mcq:        ["mcq_generation",   "mcq_validation"],
  flashcards: ["flashcards"],
  hq:         ["hq_generation",    "hq_validation"],
  trial:      ["trial_generation", "trial_validation"],
  qcu:        ["qcu_generation",   "qcu_validation"],
  // Exercises produce structured output directly — generation only.
  exercise:   ["exercise_generation"],
};

const STAGE_LABELS: Record<string, string> = {
  flashcards:       "Generation",
  mcq_generation:   "Generation",
  mcq_validation:   "Validation",
  hq_generation:    "Generation",
  hq_validation:    "Validation",
  trial_generation: "Generation",
  trial_validation: "Validation",
  qcu_generation:   "Generation",
  qcu_validation:   "Validation",
  exercise_generation: "Generation",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.0001) return `< $0.0001`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

/** Sum all token totals for a given tab from the stages dict. */
function tabTotal(usage: TokenUsage, tab: Tab): number {
  return TAB_STAGES[tab].reduce(
    (sum, s) => sum + (usage.stages[s]?.total ?? 0),
    0
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        padding: "8px 14px 4px",
      }}
    >
      {label}
    </div>
  );
}

function Row({
  label,
  sublabel,
  right,
  muted,
  bold,
}: {
  label: string;
  sublabel?: string;
  right: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        padding: "4px 14px",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            color: muted ? "var(--text-muted)" : "var(--text)",
            fontWeight: bold ? 600 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "block",
          }}
        >
          {label}
        </span>
        {sublabel && (
          <span
            style={{ fontSize: 10.5, color: "var(--text-muted)", display: "block" }}
          >
            {sublabel}
          </span>
        )}
      </div>
      <div>{right}</div>
    </div>
  );
}

function TokenBadge({
  input,
  output,
  total,
}: {
  input: number;
  output: number;
  total: number;
}) {
  return (
    <span
      title={`↑${input.toLocaleString()} in  ↓${output.toLocaleString()} out`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          color: "var(--text-muted)",
          fontFamily: "var(--mono)",
          whiteSpace: "nowrap",
        }}
      >
        ↑{fmt(input)} ↓{fmt(output)}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text)",
          fontFamily: "var(--mono)",
          minWidth: 42,
          textAlign: "right",
        }}
      >
        {fmt(total)}
      </span>
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  usage: TokenUsage;
  activeTab: Tab;
  loadingTabs: Record<Tab, boolean>;
  generatedTabs: Set<Tab>;
  onClose: () => void;
}

export function TokenUsagePanel({
  usage,
  activeTab,
  loadingTabs,
  generatedTabs,
  onClose,
}: Props) {
  const activeStages = TAB_STAGES[activeTab].filter((s) => s in usage.stages);
  const byModelEntries = Object.entries(usage.by_model);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200 }}
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
          boxShadow: "0 8px 28px rgba(0,0,0,.14)",
          width: 360,
          maxHeight: "calc(100vh - 80px)",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "11px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "var(--surface)",
            zIndex: 1,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}>
            Token Usage — {TAB_LABELS[activeTab]}
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
              fontSize: 16,
              fontFamily: "var(--font)",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Current tab detail ── */}
        {activeStages.length > 0 && (
          <>
            <SectionHeader label={`${TAB_LABELS[activeTab]} · detail`} />
            {activeStages.map((stage) => {
              const st = usage.stages[stage];
              return (
                <div key={stage}>
                  <Row
                    label={STAGE_LABELS[stage] ?? stage}
                    right={
                      <TokenBadge
                        input={st.input}
                        output={st.output}
                        total={st.total}
                      />
                    }
                  />
                  {/* Per-model breakdown within this stage */}
                  {Object.entries(st.by_model).map(([model, mt]) => (
                    <Row
                      key={model}
                      label={model}
                      sublabel={`est. ${fmtCost(mt.cost)}`}
                      muted
                      right={
                        <span
                          style={{
                            fontSize: 11.5,
                            color: "var(--text-muted)",
                            fontFamily: "var(--mono)",
                          }}
                        >
                          {fmt(mt.total)}
                        </span>
                      }
                    />
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* ── All tabs overview ── */}
        <SectionHeader label="All tabs" />
        {ALL_TABS.map((tab) => {
          const total = tabTotal(usage, tab);
          const isLoading = loadingTabs[tab];
          const isGenerated = generatedTabs.has(tab);
          const hasData = total > 0;

          return (
            <Row
              key={tab}
              label={TAB_LABELS[tab]}
              bold={tab === activeTab}
              right={
                isLoading ? (
                  <LoaderDots />
                ) : hasData ? (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: tab === activeTab ? 700 : 500,
                      color: tab === activeTab ? "var(--accent)" : "var(--text)",
                      fontFamily: "var(--mono)",
                    }}
                  >
                    {fmt(total)}
                  </span>
                ) : (
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {isGenerated ? "—" : "not run"}
                  </span>
                )
              }
            />
          );
        })}

        {/* ── By model ── */}
        {byModelEntries.length > 0 && (
          <>
            <SectionHeader label="By model" />
            {byModelEntries.map(([model, mt]) => (
              <Row
                key={model}
                label={model}
                sublabel={fmtCost(mt.cost)}
                right={
                  <TokenBadge
                    input={mt.input}
                    output={mt.output}
                    total={mt.total}
                  />
                }
              />
            ))}
          </>
        )}

        {/* ── Total ── */}
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--border)",
            marginTop: 4,
            background: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            position: "sticky",
            bottom: 0,
          }}
        >
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
              Total
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                display: "block",
                marginTop: 1,
              }}
            >
              ↑{fmt(usage.total.input)} in · ↓{fmt(usage.total.output)} out
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span
              style={{
                fontSize: 11.5,
                color: "var(--text-muted)",
                fontFamily: "var(--mono)",
              }}
            >
              {fmt(usage.total.total)} tok
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--accent)",
                fontFamily: "var(--mono)",
              }}
              title="Estimated cost based on model pricing"
            >
              {fmtCost(usage.total.cost)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
