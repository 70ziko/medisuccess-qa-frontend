"use client";

import { useEffect, useState } from "react";
import { MAX_AUTO_RETRIES, exportedImage, useDiagramQueue } from "@/lib/diagram-queue";
import { batchJson, dataUrlToBytes, downloadBlob, outputName, zipStore } from "@/lib/diagram-export";
import { PDFDropzone } from "./PDFDropzone";
import { DiagramCard } from "./DiagramCard";
import { AppHeader } from "./AppHeader";
import { Icon, IconBtn, Pill } from "./Icons";

const PARALLEL_CHOICES = [1, 2, 3, 4];

function ToolbarButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 7,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text)",
        fontFamily: "var(--font)",
        fontSize: 12.5,
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/** Staff tool: number the labels of anatomy diagrams, several at a time. */
export function DiagramApp({ header }: { header?: React.ReactNode } = {}) {
  const [parallel, setParallel] = useState(3);
  const [zoom, setZoom] = useState<{ src: string; title: string } | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const q = useDiagramQueue(parallel);
  const { jobs } = q;

  const count = (pred: (s: string) => boolean) => jobs.filter((j) => pred(j.state)).length;
  const ready = count((s) => s === "ready");
  const running = count((s) => s === "running");
  const waiting = count((s) => s === "queued" || s === "retry_wait");
  const failed = count((s) => s === "error" || s === "stopped");
  const done = jobs.filter((j) => j.state === "done" || (j.result && j.state !== "running"));
  const finished = jobs.filter((j) => j.result);
  const totalCost = jobs.reduce((n, j) => n + j.cost, 0);
  const active = running + waiting > 0;

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const exportable = () =>
    finished.map((j) => ({ job: j, image: exportedImage(j)!, fichier: outputName(j.stem) }));

  const copyAll = () => {
    const json = batchJson(exportable().map((x) => ({ fichier: x.fichier, legend: x.job.legend })));
    navigator.clipboard.writeText(json).catch(() => {});
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const downloadAll = () => {
    const items = exportable();
    const json = batchJson(items.map((x) => ({ fichier: x.fichier, legend: x.job.legend })));
    const zip = zipStore([
      ...items.map((x) => ({ name: x.fichier, data: dataUrlToBytes(x.image) })),
      { name: "legendes.json", data: new TextEncoder().encode(json) },
    ]);
    downloadBlob(zip, "schemas-numerotes.zip");
  };

  const clearAll = () => {
    if ((finished.length || active) && !window.confirm("Remove every diagram? Results you have not downloaded are lost.")) {
      return;
    }
    q.clear();
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* ── Left Panel ── */}
      <div
        style={{
          width: "var(--panel-w)",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border)",
          background: "var(--surface)",
          overflow: "auto",
        }}
      >
        {header ?? <AppHeader mode="diagrams" />}

        <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Always empty: dropped files become jobs on the right, so the dropzone only collects them. */}
          <PDFDropzone files={[]} onChange={(files) => void q.addFiles(files)} />

          {q.splitting.length > 0 && (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: -10 }}>
              Splitting {q.splitting.join(", ")} into pages…
            </p>
          )}

          <div>
            <label
              htmlFor="diagram-parallel"
              style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 5 }}
            >
              Diagrams at once
            </label>
            <select
              id="diagram-parallel"
              value={parallel}
              onChange={(e) => setParallel(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 7,
                border: "1px solid var(--border)",
                background: "#FAFAF8",
                fontSize: 13,
                fontFamily: "var(--font)",
                color: "var(--text)",
              }}
            >
              {PARALLEL_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
              Lower it if OpenAI rate limits show up. The server also caps how many run at once across everyone.
            </p>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>
            Each diagram is read, numbered, redrawn in the MediSuccess style, then checked number by number
            (a few minutes each). Redraws blocked by moderation are retried on the server; other failures that can
            pass on a new try are retried {MAX_AUTO_RETRIES} times here.
          </div>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {active && (
              <button
                onClick={q.stopAll}
                style={{
                  padding: "11px 0",
                  borderRadius: "var(--radius)",
                  background: "var(--red)",
                  color: "#fff",
                  border: "none",
                  fontFamily: "var(--font)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ width: 11, height: 11, borderRadius: 2, background: "#fff", display: "inline-block" }} />
                Stop all
              </button>
            )}
            <button
              onClick={q.startReady}
              disabled={ready === 0}
              style={{
                padding: "11px 0",
                borderRadius: "var(--radius)",
                background: ready ? "var(--accent)" : "var(--border)",
                color: ready ? "#fff" : "var(--text-muted)",
                border: "none",
                fontFamily: "var(--font)",
                fontSize: 14,
                fontWeight: 600,
                cursor: ready ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              <Icon name="sparkle" size={14} />
              {ready ? `Number ${ready} diagram${ready > 1 ? "s" : ""}` : "Number diagrams"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {jobs.length === 0 && q.splitting.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 12,
              color: "var(--text-muted)",
              textAlign: "center",
              padding: 32,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="image" size={22} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>Drop anatomy diagrams to number their labels</p>
            <p style={{ fontSize: 12.5, maxWidth: 440, lineHeight: 1.55 }}>
              PNG, JPEG or WebP images, or PDFs (one diagram per page). Each one comes back as a numbered PNG and
              its legend, editable and ready to copy as the <code>legendes</code> JSON of an anatomy fiche.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                padding: "12px 22px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--surface)",
                flexShrink: 0,
                flexWrap: "wrap",
              }}
            >
              <Pill color="accent">{jobs.length} diagrams</Pill>
              {done.length > 0 && <Pill color="green">{done.length} done</Pill>}
              {running > 0 && <Pill color="accent">{running} running</Pill>}
              {waiting > 0 && <Pill color="muted">{waiting} waiting</Pill>}
              {ready > 0 && <Pill color="muted">{ready} ready</Pill>}
              {failed > 0 && <Pill color="muted">{failed} failed or stopped</Pill>}
              {totalCost > 0 && (
                <span
                  title="Estimated OpenAI cost of every run on this page"
                  style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--mono)", marginLeft: 4 }}
                >
                  ${totalCost.toFixed(2)}
                </span>
              )}

              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                {failed > 0 && (
                  <ToolbarButton onClick={q.retryFailed}>
                    <Icon name="refresh" size={12} /> Retry failed
                  </ToolbarButton>
                )}
                {finished.length > 0 && (
                  <>
                    <ToolbarButton onClick={copyAll}>
                      <Icon name={copiedAll ? "check" : "copy"} size={12} />
                      {copiedAll ? "Copied" : "Copy all JSON"}
                    </ToolbarButton>
                    <ToolbarButton onClick={downloadAll}>
                      <Icon name="download" size={12} /> Download all (.zip)
                    </ToolbarButton>
                  </>
                )}
                <IconBtn onClick={clearAll} title="Clear all">
                  <Icon name="refresh" size={14} />
                </IconBtn>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
              {q.notices.map((n, i) => (
                <div
                  key={i}
                  role="alert"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 12,
                    padding: "9px 12px",
                    borderRadius: 7,
                    border: "1px solid var(--amber-border)",
                    background: "var(--amber-light)",
                    color: "var(--amber)",
                    fontSize: 12.5,
                  }}
                >
                  <Icon name="alert" size={13} style={{ marginTop: 2 }} />
                  <span style={{ flex: 1 }}>{n}</span>
                  <button
                    onClick={() => q.dismissNotice(i)}
                    aria-label="Dismiss"
                    style={{ border: "none", background: "none", color: "inherit", cursor: "pointer", padding: 0 }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}

              {jobs.map((job) => (
                <DiagramCard
                  key={job.id}
                  job={job}
                  now={q.now}
                  onRetry={() => q.retry(job.id)}
                  onStop={() => q.stopJob(job.id)}
                  onRemove={() => {
                    if (job.result && !window.confirm(`Remove ${job.name} and its result?`)) return;
                    q.remove(job.id);
                  }}
                  onEditLabel={(numero, label) => q.editLabel(job.id, numero, label)}
                  onResetLegend={() => q.resetLegend(job.id)}
                  onChoice={(choice) => q.setChoice(job.id, choice)}
                  onZoom={(src, title) => setZoom({ src, title })}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          role="dialog"
          aria-label={zoom.title}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(20,20,18,.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- blob/data URLs, nothing to optimise */}
          <img
            src={zoom.src}
            alt={zoom.title}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", background: "#fff", borderRadius: 6 }}
          />
        </div>
      )}
    </div>
  );
}
