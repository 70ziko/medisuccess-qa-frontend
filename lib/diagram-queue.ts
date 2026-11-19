"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DiagramChatTurn,
  DiagramEntry,
  DiagramError,
  DiagramEvent,
  DiagramLegendEntry,
  DiagramResult,
  DiagramStage,
  TokenUsage,
} from "@/types";
import { splitPdfPages, startDiagramRefine, startDiagramStream, type HttpError } from "@/lib/qa-api";
import { dataUrlToFile, stemOf } from "@/lib/diagram-export";

export type DiagramJobState =
  | "ready" // added, waiting for the user to start
  | "queued" // waiting for a free parallel slot in this browser
  | "running"
  | "retry_wait" // failed with a retryable error, re-queued at `retryAt`
  | "done"
  | "error"
  | "stopped";

export interface DiagramJob {
  id: string;
  /** Shown in the list ("notes.pdf · page 3"). */
  name: string;
  /** Output file stem ("notes-p3"). */
  stem: string;
  /** Duplicate check: same source file dropped twice. */
  sourceKey: string;
  file: File;
  previewUrl: string;
  state: DiagramJobState;
  stage: DiagramStage | null;
  message: string;
  attempt: number;
  maxAttempts: number;
  /** Blocks and rejected redraws of the current run, oldest first. */
  history: string[];
  /** Runs started, retries included. */
  runs: number;
  /** Automatic retries used since the last manual start. */
  autoRetries: number;
  retryAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  error: DiagramError | null;
  result: DiagramResult | null;
  /** Staff-edited copy of `result.legend`; this is what gets exported. */
  legend: DiagramLegendEntry[];
  /** Which image to export: the result, the closest unverified redraw, or a verified redraw's numbers-only version. */
  choice: DiagramChoice;
  /** Mode of the next run: AI redraw, or false = numbers placed by code on the upright source. Set on the card or,
   *  for every diagram at once, by the panel switch. */
  redraw: boolean;
  /** USD across every run of this image, failed ones included. */
  cost: number;
  /** Staff chat on this drawing, oldest first. */
  chat: DiagramChatTurn[];
  /** What the next run does instead of a fresh numbering; kept until it succeeds, so Retry resends it. */
  pending: DiagramPending | null;
  /** Where the current follow-up run restarted, once the server said. */
  entry: DiagramEntry | null;
}

export type DiagramChoice = "final" | "redraw" | "numbered";

/** A follow-up run on the last result: a chat message, the AI-redraw button, or a full run that keeps the chat's
 *  instructions. */
export type DiagramPending = { kind: "chat"; message: string } | { kind: "redraw" } | { kind: "rerun" };

export const MAX_AUTO_RETRIES = 2;
const DIAGRAM_MIMES = ["image/png", "image/jpeg", "image/webp"];

// Rate limits need the provider's window to pass; refusals and flags usually clear on a new try.
function backoffMs(code: string, retriesUsed: number): number {
  const base = code === "rate_limited" ? 30_000 : code === "connection" || code === "timeout" ? 10_000 : 5_000;
  return base * (retriesUsed + 1);
}

function httpToDiagramError(err: HttpError): DiagramError {
  const status = err.status;
  if (err.midStream) {
    return {
      code: "connection",
      message: `The connection to the server was cut mid-run (server restart or proxy timeout): ${err.message}`,
      retryable: true,
    };
  }
  if (status === undefined) {
    return {
      code: "connection",
      message: `Could not reach the server: ${err.message}`,
      retryable: true,
    };
  }
  return {
    code: `http_${status}`,
    message: status === 401 ? "Wrong staff username or password." : err.message,
    retryable: status === 429 || status >= 500,
  };
}

const STREAM_CLOSED: DiagramError = {
  code: "connection",
  message: "The connection closed before the diagram was finished (server restart or proxy timeout).",
  retryable: true,
};

let seq = 0;
const newId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

function isPdf(f: File) {
  return f.type === "application/pdf" || /\.pdf$/i.test(f.name);
}

function diagramMime(f: File): string | null {
  if (DIAGRAM_MIMES.includes(f.type)) return f.type;
  if (/\.png$/i.test(f.name)) return "image/png";
  if (/\.jpe?g$/i.test(f.name)) return "image/jpeg";
  if (/\.webp$/i.test(f.name)) return "image/webp";
  return null;
}

function newJob(file: File, name: string, stem: string, sourceKey: string, redraw: boolean): DiagramJob {
  return {
    id: newId(),
    name,
    stem,
    sourceKey,
    file,
    previewUrl: URL.createObjectURL(file),
    state: "ready",
    stage: null,
    message: "",
    attempt: 0,
    maxAttempts: 0,
    history: [],
    runs: 0,
    autoRetries: 0,
    retryAt: null,
    startedAt: null,
    finishedAt: null,
    error: null,
    result: null,
    legend: [],
    choice: "final",
    redraw,
    cost: 0,
    chat: [],
    pending: null,
    entry: null,
  };
}

const keyOf = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
const ACTIVE: DiagramJobState[] = ["queued", "running", "retry_wait"];
const QUEUED = { state: "queued", error: null, retryAt: null, autoRetries: 0 } as const;

/** The chat with the server's answer to a chat message appended; other follow-ups leave it as it is. */
function answered(job: DiagramJob, reply: string | undefined, entry: DiagramEntry | undefined): DiagramChatTurn[] {
  return job.pending?.kind === "chat" && reply ? [...job.chat, { role: "assistant", text: reply, entry }] : job.chat;
}

/** `redraw`: the mode new diagrams get when dropped. */
export function useDiagramQueue(parallel: number, redraw = true) {
  const [jobs, setJobs] = useState<DiagramJob[]>([]);
  const defaultRedraw = useRef(redraw);
  defaultRedraw.current = redraw;
  const [notices, setNotices] = useState<string[]>([]);
  const [splitting, setSplitting] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  // Abort handle + run token per running job; events from an older run are ignored.
  const runs = useRef(new Map<string, { token: number; stop: () => void }>());
  const tokens = useRef(0);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const update = useCallback((id: string, fn: (j: DiagramJob) => DiagramJob) => {
    setJobs((js) => js.map((j) => (j.id === id ? fn(j) : j)));
  }, []);

  const fail = useCallback(
    (id: string, error: DiagramError, usage?: TokenUsage) => {
      runs.current.delete(id);
      update(id, (j) => {
        const auto = error.retryable && j.autoRetries < MAX_AUTO_RETRIES;
        const at = Date.now();
        return {
          ...j,
          state: auto ? "retry_wait" : "error",
          retryAt: auto ? at + backoffMs(error.code, j.autoRetries) : null,
          autoRetries: auto ? j.autoRetries + 1 : j.autoRetries,
          error,
          finishedAt: at,
          cost: j.cost + (usage?.total.cost ?? 0),
        };
      });
    },
    [update]
  );

  const launch = useCallback(
    (job: DiagramJob) => {
      if (runs.current.has(job.id)) return;
      const token = ++tokens.current;
      const live = () => runs.current.get(job.id)?.token === token;
      let finished = false;

      update(job.id, (j) => ({
        ...j,
        state: "running",
        stage: null,
        message: "Uploading",
        attempt: 0,
        maxAttempts: 0,
        history: [],
        runs: j.runs + 1,
        retryAt: null,
        startedAt: Date.now(),
        finishedAt: null,
        entry: null,
      }));

      const onEvent = (e: DiagramEvent) => {
        if (!live()) return;
        if (e.type === "progress") {
          const note =
            e.stage === "blocked" || e.stage === "redraw_failed" || (e.stage === "checked" && e.issues?.length)
              ? e.message
              : null;
          update(job.id, (j) => ({
            ...j,
            stage: e.stage,
            message: e.message,
            attempt: e.attempt ?? j.attempt,
            maxAttempts: e.max_attempts ?? j.maxAttempts,
            history: note ? [...j.history, note] : j.history,
            entry: e.entry ?? j.entry,
          }));
        } else if (e.type === "diagram_result") {
          finished = true;
          runs.current.delete(job.id);
          update(job.id, (j) => ({
            ...j,
            state: "done",
            result: e.data,
            legend: e.data.legend.map((x) => ({ ...x })),
            choice: "final",
            error: null,
            finishedAt: Date.now(),
            cost: j.cost + e.data.usage.total.cost,
            chat: answered(j, e.data.reply, e.data.entry),
            pending: null,
          }));
        } else if (e.type === "diagram_reply") {
          // No image work: the images stay; a reworded legend shows as edits against the last result.
          finished = true;
          runs.current.delete(job.id);
          update(job.id, (j) => ({
            ...j,
            state: "done",
            result: j.result && { ...j.result, state: e.state },
            legend: e.legend.map((x) => ({ ...x })),
            error: null,
            finishedAt: Date.now(),
            cost: j.cost + e.usage.total.cost,
            chat: answered(j, e.message, e.entry),
            pending: null,
          }));
        } else if (e.type === "error") {
          finished = true;
          fail(job.id, { code: e.code, message: e.message, retryable: e.retryable, request_id: e.request_id }, e.usage);
        }
      };

      const onError = (err: HttpError) => {
        if (!live() || finished) return;
        finished = true;
        fail(job.id, httpToDiagramError(err));
      };
      const onEnd = () => {
        if (!live() || finished) return;
        finished = true;
        fail(job.id, STREAM_CLOSED);
      };
      const pending = job.pending;
      const state = job.result?.state;
      const stop =
        pending && state
          ? startDiagramRefine(
              job.file,
              {
                state,
                legend: job.legend,
                redraw: job.redraw,
                ...(pending.kind === "chat"
                  ? { message: pending.message, history: job.chat.slice(0, -1) }
                  : { entry: pending.kind === "redraw" ? "redraw" : "orient" }),
              },
              onEvent,
              onError,
              onEnd
            )
          : startDiagramStream(job.file, onEvent, onError, onEnd, { redraw: job.redraw });
      runs.current.set(job.id, { token, stop });
    },
    [fail, update]
  );

  // Fill free parallel slots from the queue, oldest first.
  useEffect(() => {
    const running = jobs.filter((j) => j.state === "running").length;
    const free = parallel - running;
    if (free <= 0) return;
    jobs.filter((j) => j.state === "queued").slice(0, free).forEach(launch);
  }, [jobs, parallel, launch]);

  // One clock for elapsed times and retry countdowns, only while something is active.
  const hasActive = jobs.some((j) => ACTIVE.includes(j.state));
  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasActive]);

  useEffect(() => {
    setJobs((js) =>
      js.some((j) => j.state === "retry_wait" && (j.retryAt ?? 0) <= now)
        ? js.map((j) =>
            j.state === "retry_wait" && (j.retryAt ?? 0) <= now ? { ...j, state: "queued", retryAt: null } : j
          )
        : js
    );
  }, [now]);

  // Release the object URLs and in-flight streams when the page goes away.
  useEffect(() => {
    const active = runs.current;
    return () => {
      active.forEach((r) => r.stop());
      jobsRef.current.forEach((j) => URL.revokeObjectURL(j.previewUrl));
    };
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const known = new Set(jobsRef.current.map((j) => j.sourceKey));
    const fresh = files.filter((f) => !known.has(keyOf(f)));
    const rejected = fresh.filter((f) => !isPdf(f) && !diagramMime(f));
    if (rejected.length) {
      setNotices((n) => [
        ...n,
        `${rejected.map((f) => f.name).join(", ")}: only PNG, JPEG, WebP images or PDFs can be numbered.`,
      ]);
    }
    const images = fresh.filter((f) => !isPdf(f) && diagramMime(f));
    if (images.length) {
      setJobs((js) => [
        ...js,
        ...images.map((f) => newJob(f, f.name, stemOf(f.name), keyOf(f), defaultRedraw.current)),
      ]);
    }
    for (const pdf of fresh.filter(isPdf)) {
      setSplitting((s) => [...s, pdf.name]);
      try {
        const pages = await splitPdfPages(pdf);
        const stem = stemOf(pdf.name);
        setJobs((js) => [
          ...js,
          ...pages.map((p) =>
            newJob(
              dataUrlToFile(p.image, `${stem}-p${p.page}.jpg`),
              `${pdf.name} · page ${p.page}`,
              `${stem}-p${p.page}`,
              keyOf(pdf),
              defaultRedraw.current
            )
          ),
        ]);
      } catch (err) {
        setNotices((n) => [...n, `${pdf.name}: ${(err as Error).message}`]);
      } finally {
        setSplitting((s) => s.filter((name) => name !== pdf.name));
      }
    }
  }, []);

  /** Starts every diagram that `needsRun`: new ones, and numbers-only results since switched to AI redraw, which
   *  get only the redraw on their existing reading. */
  const startPending = useCallback(() => {
    setJobs((js) =>
      js.map((j) =>
        needsRun(j)
          ? {
              ...j,
              ...QUEUED,
              pending: j.state === "done" && j.result?.state ? { kind: "redraw" } : j.pending,
            }
          : j
      )
    );
  }, []);

  const stopJob = useCallback((id: string) => {
    runs.current.get(id)?.stop();
    runs.current.delete(id);
    update(id, (j) =>
      ACTIVE.includes(j.state) ? { ...j, state: "stopped", retryAt: null, finishedAt: Date.now() } : j
    );
  }, [update]);

  const stopAll = useCallback(() => {
    runs.current.forEach((r) => r.stop());
    runs.current.clear();
    setJobs((js) =>
      js.map((j) =>
        ACTIVE.includes(j.state) ? { ...j, state: "stopped", retryAt: null, finishedAt: Date.now() } : j
      )
    );
  }, []);

  /** Manual start of a failed or stopped job, resending its pending follow-up if any; fresh auto-retry budget. */
  const retry = useCallback((id: string) => {
    update(id, (j) => ({ ...j, ...QUEUED }));
  }, [update]);

  /** A full run from scratch: the chat and its instructions are dropped. */
  const startOver = useCallback((id: string) => {
    update(id, (j) => ({ ...j, ...QUEUED, chat: [], pending: null }));
  }, [update]);

  /** A chat message about the last result; the server picks the step to restart from. */
  const ask = useCallback((id: string, message: string) => {
    const text = message.trim();
    if (!text) return;
    update(id, (j) =>
      j.result?.state && !ACTIVE.includes(j.state)
        ? { ...j, ...QUEUED, chat: [...j.chat, { role: "user", text }], pending: { kind: "chat", message: text } }
        : j
    );
  }, [update]);

  /** The image model on the last result's numbering, without reading the drawing again. */
  const aiRedraw = useCallback((id: string) => {
    update(id, (j) =>
      j.result?.state && !ACTIVE.includes(j.state) ? { ...j, ...QUEUED, redraw: true, pending: { kind: "redraw" } } : j
    );
  }, [update]);

  /** A full run that keeps the chat's instructions (reading notes, roles, added markers, redraw notes). */
  const rerunWithInstructions = useCallback((id: string) => {
    update(id, (j) =>
      j.result?.state && !ACTIVE.includes(j.state) ? { ...j, ...QUEUED, pending: { kind: "rerun" } } : j
    );
  }, [update]);

  const retryFailed = useCallback(() => {
    setJobs((js) =>
      js.map((j) =>
        j.state === "error" || j.state === "stopped"
          ? { ...j, state: "queued", error: null, retryAt: null, autoRetries: 0 }
          : j
      )
    );
  }, []);

  /** Mode of one diagram's next run; a running diagram keeps the mode it started with. */
  const setMode = useCallback((id: string, redraw: boolean) => {
    update(id, (j) => withMode(j, redraw));
  }, [update]);

  /** The panel switch: every diagram that is not running takes the mode. */
  const setAllModes = useCallback((redraw: boolean) => {
    setJobs((js) => js.map((j) => withMode(j, redraw)));
  }, []);

  const remove = useCallback((id: string) => {
    runs.current.get(id)?.stop();
    runs.current.delete(id);
    setJobs((js) => {
      const gone = js.find((j) => j.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return js.filter((j) => j.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    runs.current.forEach((r) => r.stop());
    runs.current.clear();
    jobsRef.current.forEach((j) => URL.revokeObjectURL(j.previewUrl));
    setJobs([]);
    setNotices([]);
  }, []);

  const editLabel = useCallback((id: string, numero: number, label: string) => {
    update(id, (j) => ({ ...j, legend: j.legend.map((e) => (e.numero === numero ? { ...e, label } : e)) }));
  }, [update]);

  const resetLegend = useCallback((id: string) => {
    update(id, (j) => ({ ...j, legend: (j.result?.legend ?? []).map((e) => ({ ...e })) }));
  }, [update]);

  const setChoice = useCallback((id: string, choice: DiagramChoice) => {
    update(id, (j) => ({ ...j, choice }));
  }, [update]);

  const dismissNotice = useCallback((i: number) => {
    setNotices((n) => n.filter((_, k) => k !== i));
  }, []);

  return {
    jobs,
    now,
    notices,
    splitting,
    addFiles,
    startPending,
    stopJob,
    stopAll,
    retry,
    startOver,
    ask,
    aiRedraw,
    rerunWithInstructions,
    retryFailed,
    remove,
    clear,
    editLabel,
    resetLegend,
    setChoice,
    setMode,
    setAllModes,
    dismissNotice,
  };
}

/** The mode applied to a finished diagram: a redraw run already holds its numbers-only version, so it is selected
 *  without a new run. A running diagram keeps the mode it started with. */
function withMode(job: DiagramJob, redraw: boolean): DiagramJob {
  if (job.state === "running") return job;
  const status = job.result?.status;
  const choice: DiagramChoice =
    status === "verified" && job.result?.numbered_image
      ? redraw
        ? "final"
        : "numbered"
      : redraw
        ? job.choice
        : "final";
  return { ...job, redraw, choice };
}

/** Waiting for its first run, or holding a numbers-only result while set to AI redraw. */
export function needsRun(job: DiagramJob): boolean {
  return job.state === "ready" || (job.state === "done" && job.redraw && job.result?.status === "numbers_only");
}

/** Standing instructions the chat left on this diagram, which "Run again with instructions" keeps. */
export function hasInstructions(job: DiagramJob): boolean {
  const s = job.result?.state;
  return !!s && [s.read_notes, s.redraw_notes, s.role_overrides, s.added_markers].some((list) => list?.length > 0);
}

/** Staff changed a label of the legend the server returned. */
export function legendEdited(job: DiagramJob): boolean {
  const result = job.result;
  return !!result && job.legend.some((e, i) => e.label !== result.legend[i]?.label);
}

/** The image a job exports: its result, or the alternative staff picked on the card. */
export function exportedImage(job: DiagramJob): string | null {
  if (!job.result) return null;
  if (job.choice === "redraw" && job.result.redraw_image) return job.result.redraw_image;
  if (job.choice === "numbered" && job.result.numbered_image) return job.result.numbered_image;
  return job.result.image;
}
