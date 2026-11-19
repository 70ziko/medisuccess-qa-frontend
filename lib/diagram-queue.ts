"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DiagramError,
  DiagramEvent,
  DiagramLegendEntry,
  DiagramResult,
  DiagramStage,
  TokenUsage,
} from "@/types";
import { splitPdfPages, startDiagramStream, type HttpError } from "@/lib/qa-api";
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
  /** Which image to export when the redraw did not pass verification. */
  choice: "final" | "redraw";
  /** USD across every run of this image, failed ones included. */
  cost: number;
}

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

function newJob(file: File, name: string, stem: string, sourceKey: string): DiagramJob {
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
    cost: 0,
  };
}

const keyOf = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
const ACTIVE: DiagramJobState[] = ["queued", "running", "retry_wait"];

export function useDiagramQueue(parallel: number) {
  const [jobs, setJobs] = useState<DiagramJob[]>([]);
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
          }));
        } else if (e.type === "error") {
          finished = true;
          fail(job.id, { code: e.code, message: e.message, retryable: e.retryable, request_id: e.request_id }, e.usage);
        }
      };

      const stop = startDiagramStream(
        job.file,
        onEvent,
        (err) => {
          if (!live() || finished) return;
          finished = true;
          fail(job.id, httpToDiagramError(err));
        },
        () => {
          if (!live() || finished) return;
          finished = true;
          fail(job.id, STREAM_CLOSED);
        }
      );
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
      setJobs((js) => [...js, ...images.map((f) => newJob(f, f.name, stemOf(f.name), keyOf(f)))]);
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
              keyOf(pdf)
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

  const startReady = useCallback(() => {
    setJobs((js) => js.map((j) => (j.state === "ready" ? { ...j, state: "queued", autoRetries: 0 } : j)));
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

  /** Manual start of a failed, stopped or finished job; gives it a fresh auto-retry budget. */
  const retry = useCallback((id: string) => {
    update(id, (j) => ({ ...j, state: "queued", error: null, retryAt: null, autoRetries: 0 }));
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

  const setChoice = useCallback((id: string, choice: "final" | "redraw") => {
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
    startReady,
    stopJob,
    stopAll,
    retry,
    retryFailed,
    remove,
    clear,
    editLabel,
    resetLegend,
    setChoice,
    dismissNotice,
  };
}

/** The image a job exports: the numbered result, or the closest redraw when staff picked it. */
export function exportedImage(job: DiagramJob): string | null {
  if (!job.result) return null;
  return job.choice === "redraw" && job.result.redraw_image ? job.result.redraw_image : job.result.image;
}
