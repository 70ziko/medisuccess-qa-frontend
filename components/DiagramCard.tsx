"use client";

import { useState } from "react";
import type { DiagramResult } from "@/types";
import type { DiagramChoice, DiagramJob } from "@/lib/diagram-queue";
import { MAX_AUTO_RETRIES, exportedImage, hasInstructions } from "@/lib/diagram-queue";
import { downloadDataUrl, ficheJson, hasNumberingGap, outputName } from "@/lib/diagram-export";
import { Icon, IconBtn, LoaderDots } from "./Icons";
import { DiagramBoxes } from "./DiagramBoxes";
import { DiagramChat } from "./DiagramChat";
import { ModeSwitch } from "./ModeSwitch";

type Tone = "muted" | "accent" | "green" | "amber" | "red";

const TONES: Record<Tone, { bg: string; border: string; text: string }> = {
  muted: { bg: "#F7F6F3", border: "var(--border)", text: "var(--text-muted)" },
  accent: { bg: "var(--accent-light)", border: "var(--accent-border)", text: "var(--accent)" },
  green: { bg: "var(--green-light)", border: "var(--green-border)", text: "var(--green)" },
  amber: { bg: "var(--amber-light)", border: "var(--amber-border)", text: "var(--amber)" },
  red: { bg: "var(--red-light)", border: "var(--red-border)", text: "var(--red)" },
};

function status(job: DiagramJob): { label: string; tone: Tone } {
  switch (job.state) {
    case "ready":
      return { label: "Ready", tone: "muted" };
    case "queued":
      return { label: "Queued", tone: "muted" };
    case "running":
      return { label: job.stage === "queued" ? "Waiting for server" : "Running", tone: "accent" };
    case "retry_wait":
      return { label: "Retrying", tone: "amber" };
    case "done":
      if (job.result?.status === "verified") return { label: "Verified", tone: "green" };
      if (job.result?.status === "numbers_only") return { label: "Numbers only", tone: "green" };
      return { label: "Numbered source", tone: "amber" };
    case "error":
      return { label: "Failed", tone: "red" };
    case "stopped":
      return { label: "Stopped", tone: "muted" };
  }
}

// Where a follow-up run starts on the bar, by the step it restarts from.
const ENTRY_SHARE: Record<string, number> = {
  answer: 0.9,
  legend: 0.9,
  redraw: 0.42,
  number: 0.38,
  read: 0.12,
  orient: 0.04,
};

// Rough share of the run done at each stage; the redraw loop fills the last half.
function progressShare(job: DiagramJob): number {
  if (job.stage === "routed") return ENTRY_SHARE[job.entry ?? ""] ?? 0.05;
  const fixed: Record<string, number> = {
    queued: 0.02,
    route: 0.03,
    orient: 0.08,
    text: 0.18,
    reread: 0.32,
    axes: 0.38,
    numbered: 0.42,
  };
  if (!job.stage) return 0.02;
  if (job.stage in fixed) return fixed[job.stage];
  const total = Math.max(job.maxAttempts, 1);
  const within = job.stage === "verify" || job.stage === "checked" ? 0.75 : 0.25;
  return Math.min(0.97, 0.42 + (0.55 * (Math.max(job.attempt, 1) - 1 + within)) / total);
}

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Box({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) {
  const c = TONES[tone];
  return (
    <div
      role={tone === "red" ? "alert" : undefined}
      style={{
        padding: "9px 12px",
        borderRadius: 7,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.text,
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function SmallButton({
  onClick,
  children,
  primary,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 11px",
        borderRadius: 7,
        border: primary ? "none" : "1px solid var(--border)",
        background: primary ? "var(--accent)" : "var(--surface)",
        color: primary ? "#fff" : "var(--text)",
        fontFamily: "var(--font)",
        fontSize: 12.5,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

interface Props {
  job: DiagramJob;
  now: number;
  /** Failed or stopped: the same run again, a pending chat message included. */
  onRetry: () => void;
  /** The whole pipeline from the source, dropping the chat and its instructions. */
  onStartOver: () => void;
  onAsk: (message: string) => void;
  /** The image model on the current numbering, without reading the drawing again. */
  onAiRedraw: () => void;
  /** The whole pipeline, keeping the chat's instructions. */
  onRerunWithInstructions: () => void;
  onStop: () => void;
  onRemove: () => void;
  onEditLabel: (numero: number, label: string) => void;
  onResetLegend: () => void;
  onChoice: (choice: DiagramChoice) => void;
  /** This diagram's mode: AI redraw or numbers only. */
  onMode: (redraw: boolean) => void;
  onZoom: (src: string, title: string) => void;
}

/** View tabs for a result: what it holds depends on how the run ended. */
function resultTabs(result: DiagramResult): [DiagramChoice, string][] {
  if (result.status === "numbers_only") return [["final", "Numbers only"]];
  if (result.status === "verified") {
    return result.numbered_image
      ? [
          ["final", "AI redraw"],
          ["numbered", "Numbers only"],
        ]
      : [["final", "AI redraw"]];
  }
  return result.redraw_image
    ? [
        ["final", "Numbers only"],
        ["redraw", "Closest redraw (unverified)"],
      ]
    : [["final", "Numbers only"]];
}

export function DiagramCard({
  job,
  now,
  onRetry,
  onStartOver,
  onAsk,
  onAiRedraw,
  onRerunWithInstructions,
  onStop,
  onRemove,
  onEditLabel,
  onResetLegend,
  onChoice,
  onMode,
  onZoom,
}: Props) {
  const [view, setView] = useState<"result" | "original" | "boxes">("result");
  const [copied, setCopied] = useState(false);
  const pill = TONES[status(job).tone];
  const result = job.result;
  const active = job.state === "queued" || job.state === "running" || job.state === "retry_wait";
  const exported = exportedImage(job);
  const edited = !!result && job.legend.some((e, i) => e.label !== result.legend[i]?.label);
  const elapsed = job.startedAt ? (job.finishedAt ?? now) - job.startedAt : 0;
  const shown = view === "original" || !exported ? job.previewUrl : exported;

  const copyJson = () => {
    navigator.clipboard.writeText(ficheJson(job.legend)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const instructions = hasInstructions(job);
  const followUp = !!result?.state && !active;

  const startOver = () => {
    const lost = [edited && "your legend edits", (job.chat.length > 0 || instructions) && "the chat and its instructions"]
      .filter(Boolean)
      .join(" and ");
    if (lost && !window.confirm(`Start over from the source? This drops ${lost}.`)) return;
    onStartOver();
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 14,
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "var(--text-muted)" }}>
          <Icon name="image" size={15} />
        </span>
        <span
          title={job.name}
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {job.name}
        </span>
        <ModeSwitch
          compact
          redraw={job.redraw}
          onChange={onMode}
          disabled={job.state === "running"}
          title={job.state === "running" ? "Runs in the mode it started with" : "This diagram's output"}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 8px",
            borderRadius: 5,
            background: pill.bg,
            border: `1px solid ${pill.border}`,
            color: pill.text,
            fontFamily: "var(--mono)",
            whiteSpace: "nowrap",
          }}
        >
          {status(job).label}
        </span>
        {job.startedAt && (
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
            {clock(elapsed)}
          </span>
        )}
        {job.cost > 0 && (
          <span
            title="Estimated OpenAI cost, all runs of this image"
            style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--mono)" }}
          >
            ${job.cost.toFixed(2)}
          </span>
        )}
        {active ? (
          <IconBtn onClick={onStop} title="Stop">
            <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--red)", display: "inline-block" }} />
          </IconBtn>
        ) : (
          job.state !== "ready" && (
            <IconBtn
              onClick={job.state === "done" ? startOver : onRetry}
              title={job.state === "done" ? "Start over" : job.pending ? "Retry the last request" : "Retry"}
            >
              <Icon name="refresh" size={13} />
            </IconBtn>
          )
        )}
        <IconBtn onClick={onRemove} title="Remove">
          <Icon name="x" size={13} />
        </IconBtn>
      </div>

      {/* Live progress */}
      {(job.state === "running" || job.state === "queued") && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
            <LoaderDots />
            <span>
              {job.state === "queued" ? "Waiting for a free slot in this browser" : job.message || "Starting"}
            </span>
          </div>
          <div style={{ height: 3, background: "var(--border)", borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
            <div
              style={{
                height: "100%",
                width: `${Math.round(progressShare(job) * 100)}%`,
                background: "var(--accent)",
                transition: "width .4s ease",
              }}
            />
          </div>
          {job.runs > 1 && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Run {job.runs}</p>
          )}
        </div>
      )}

      {/* Failure, with the reason the server gave */}
      {job.error && (job.state === "error" || job.state === "retry_wait") && (
        <Box tone={job.state === "error" ? "red" : "amber"}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {job.state === "retry_wait"
              ? `Failed — retrying automatically in ${Math.max(0, Math.ceil(((job.retryAt ?? now) - now) / 1000))} s (retry ${job.autoRetries}/${MAX_AUTO_RETRIES})`
              : job.error.retryable
                ? `Failed after ${job.runs} run${job.runs > 1 ? "s" : ""} — retrying may still work`
                : "Failed — retrying the same image will not help"}
          </div>
          <div>{job.error.message}</div>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", opacity: 0.8, marginTop: 4 }}>
            {job.error.code}
            {job.error.request_id ? ` · ${job.error.request_id}` : ""}
          </div>
          {job.state === "error" && (
            <div style={{ marginTop: 8 }}>
              <SmallButton onClick={onRetry}>
                <Icon name="refresh" size={12} /> Retry
              </SmallButton>
            </div>
          )}
        </Box>
      )}

      {job.history.length > 0 && job.state !== "done" && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          {job.history.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}

      {followUp && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: "var(--text-muted)",
          }}
        >
          {job.redraw && result?.status === "numbers_only" && <span>Set to AI redraw: this result has numbers only.</span>}
          <SmallButton
            primary={job.redraw && result?.status === "numbers_only"}
            onClick={onAiRedraw}
          >
            <Icon name="sparkle" size={12} /> {result?.status === "verified" ? "AI redraw again" : "AI redraw"}
          </SmallButton>
          {instructions && (
            <SmallButton onClick={onRerunWithInstructions}>
              <Icon name="refresh" size={12} /> Run again with instructions
            </SmallButton>
          )}
          <span style={{ fontSize: 11.5 }}>
            {result?.status === "verified"
              ? "A new redraw of this numbering; the drawing is not read again."
              : "Redraws this numbering with the image model; the drawing is not read again."}
          </span>
        </div>
      )}

      {/* Before a result: the source, small */}
      {!result && (
        <button
          onClick={() => onZoom(job.previewUrl, job.name)}
          style={{ padding: 0, border: "none", background: "none", cursor: "zoom-in", alignSelf: "flex-start" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- blob/data URLs, nothing to optimise */}
          <img
            src={job.previewUrl}
            alt={`Source: ${job.name}`}
            style={{
              height: 120,
              maxWidth: 260,
              objectFit: "contain",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "#fff",
              display: "block",
            }}
          />
        </button>
      )}

      {/* Result */}
      {result && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 2, background: "var(--bg)", borderRadius: 8, padding: 3 }}>
              {[...resultTabs(result), ["original", "Original"] as const].map(([id, label]) => {
                const selected = id === "original" ? view === "original" : view === "result" && job.choice === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (id === "original") return setView("original");
                      setView("result");
                      onChoice(id);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "none",
                      fontSize: 12,
                      fontWeight: 500,
                      background: selected ? "var(--surface)" : "transparent",
                      color: selected ? "var(--text)" : "var(--text-muted)",
                      boxShadow: selected ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                      cursor: "pointer",
                      fontFamily: "var(--font)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
              </div>
              {result.debug && (
                <button
                  onClick={() => setView(view === "boxes" ? "result" : "boxes")}
                  title="Debug: the text boxes the reading step found"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: `1px dashed ${view === "boxes" ? "var(--amber)" : "var(--border)"}`,
                    background: view === "boxes" ? "var(--amber-light)" : "transparent",
                    color: view === "boxes" ? "var(--amber)" : "var(--text-muted)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "var(--font)",
                  }}
                >
                  Boxes (debug)
                </button>
              )}
            </div>
            {view === "boxes" && result.debug ? (
              <DiagramBoxes debug={result.debug} />
            ) : (
            <button
              onClick={() => onZoom(shown, job.name)}
              style={{ padding: 0, border: "none", background: "none", cursor: "zoom-in" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob/data URLs, nothing to optimise */}
              <img
                src={shown}
                alt={view === "original" ? `Source: ${job.name}` : `Numbered: ${job.name}`}
                style={{
                  width: "100%",
                  maxHeight: 520,
                  objectFit: "contain",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "#fff",
                  display: "block",
                }}
              />
            </button>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <SmallButton primary onClick={() => exported && downloadDataUrl(exported, outputName(job.stem))}>
                <Icon name="download" size={12} /> Download PNG
              </SmallButton>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
                {outputName(job.stem)}
              </span>
            </div>
          </div>

          <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Légendes · {job.legend.length}
              </span>
              {edited && (
                <button
                  onClick={onResetLegend}
                  style={{
                    border: "none",
                    background: "none",
                    color: "var(--accent)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "var(--font)",
                    padding: 0,
                  }}
                >
                  Reset edits
                </button>
              )}
              <span style={{ marginLeft: "auto" }}>
                <SmallButton onClick={copyJson}>
                  <Icon name={copied ? "check" : "copy"} size={12} />
                  {copied ? "Copied" : "Copy JSON"}
                </SmallButton>
              </span>
            </div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              {job.legend.map((entry, i) => {
                const changed = entry.label !== result.legend[i]?.label;
                return (
                  <li key={entry.numero} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 26,
                        textAlign: "right",
                        fontFamily: "var(--mono)",
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      {entry.numero}
                    </span>
                    <input
                      value={entry.label}
                      onChange={(e) => onEditLabel(entry.numero, e.target.value)}
                      aria-label={`Label ${entry.numero}`}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "6px 9px",
                        borderRadius: 7,
                        border: `1px solid ${changed ? "var(--accent-border)" : "var(--border)"}`,
                        background: changed ? "var(--accent-light)" : "#FAFAF8",
                        fontSize: 13,
                        fontFamily: "var(--font)",
                        color: "var(--text)",
                        outline: "none",
                      }}
                    />
                  </li>
                );
              })}
            </ol>
            {hasNumberingGap(job.legend) && (
              <Box tone="amber">The numbers are not 1 to {job.legend.length} in a row, so the JSON positions will not match the image.</Box>
            )}
            <details>
              <summary style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                JSON for the platform (<code>legendes</code> of the anatomy fiche)
              </summary>
              <pre
                style={{
                  margin: "6px 0 0",
                  padding: 10,
                  background: "var(--bg)",
                  borderRadius: 7,
                  fontSize: 11.5,
                  fontFamily: "var(--mono)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 260,
                  overflow: "auto",
                }}
              >
                {ficheJson(job.legend)}
              </pre>
            </details>
          </div>
        </div>
      )}

      {result && result.moderation && (
        <Box tone="amber">
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 4 }}>
            <Icon name="alert" size={13} /> Blocked by OpenAI&apos;s safety filter
          </div>
          <div>
            OpenAI refused {result.moderation.blocked} redraw{result.moderation.blocked > 1 ? "s" : ""}.{" "}
            {result.moderation.reasons.length > 0 ? (
              <>
                Reason given: <b>{result.moderation.reasons.join(", ")}</b>.
              </>
            ) : (
              "OpenAI gave no reason, only “rejected by the safety system”."
            )}
          </div>
          {result.status === "source_fallback" && (
            <div style={{ marginTop: 4 }}>
              No AI redraw is used here: the image is your uploaded drawing with its labels erased and the numbers
              added by the server. The legend still matches those numbers. Running it again can pass.
            </div>
          )}
          {result.moderation.request_ids.length > 0 && (
            <details style={{ marginTop: 6, fontSize: 12 }}>
              <summary style={{ cursor: "pointer" }}>OpenAI request IDs (for support)</summary>
              <div style={{ fontFamily: "var(--mono)", marginTop: 4, wordBreak: "break-all" }}>
                {result.moderation.request_ids.map((id) => (
                  <div key={id}>{id}</div>
                ))}
              </div>
            </details>
          )}
        </Box>
      )}

      {result && result.warnings.length > 0 && (
        <Box tone="amber">
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 4 }}>
            <Icon name="alert" size={13} /> Check before publishing
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Box>
      )}

      {result && result.attempts.length > 0 && (
        <details>
          <summary style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
            {result.attempts.length} redraw attempt{result.attempts.length > 1 ? "s" : ""}
            {result.moderation ? ` (${result.moderation.blocked} blocked)` : ""} · {result.seconds.toFixed(0)} s
            {result.rotation_clockwise ? ` · source turned ${result.rotation_clockwise}°` : ""}
          </summary>
          <ol style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {result.attempts.map((a) => (
              <li key={a.attempt}>
                {a.error
                  ? a.error_code === "moderation_blocked"
                    ? `${a.error}${a.request_id ? ` (${a.request_id})` : ""}`
                    : `Failed: ${a.error}`
                  : a.issues.length
                    ? `Rejected: ${a.issues.join("; ")}`
                    : "Verified"}
              </li>
            ))}
          </ol>
        </details>
      )}

      {result && (
        <DiagramChat turns={job.chat} busy={active} disabled={!result.state} onSend={onAsk} />
      )}
    </div>
  );
}
