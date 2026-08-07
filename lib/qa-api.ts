import type {
  ChatMessage,
  ChatResponse,
  Flashcard,
  GenerateParams,
  GenerateResponse,
  GenerateSectionResponse,
  MCQ,
  MCQVariant,
  SSEEvent,
  Tab,
} from "@/types";
import { TABS } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_USER = "medisuccess";

const STORAGE_KEY = "qa-basic-auth";

type Credentials = { user: string; pass: string };

let cached: Credentials | null = null;

function readStoredCredentials(): Credentials | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Credentials>;
    if (!parsed?.user || !parsed?.pass) return null;
    cached = { user: parsed.user, pass: parsed.pass };
    return cached;
  } catch {
    // Private-mode/quota failures and malformed entries fall back to prompting.
    return null;
  }
}

function storeCredentials(credentials: Credentials) {
  cached = credentials;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // Non-fatal: the in-memory cache still covers this page view.
  }
}

function clearCredentials() {
  cached = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the in-memory cache is already cleared.
  }
}

function ensureCredentials(): Credentials {
  const stored = readStoredCredentials();
  if (stored) return stored;

  if (typeof window === "undefined") {
    throw new Error("Missing API credentials for basic auth");
  }

  const user = window.prompt("API username", DEFAULT_USER)?.trim() ?? "";
  const pass = window.prompt("API password") ?? "";

  if (!user || !pass) {
    throw new Error("Basic auth credentials are required");
  }

  const credentials = { user, pass };
  storeCredentials(credentials);
  return credentials;
}

function authHeader(): string {
  const { user, pass } = ensureCredentials();
  return "Basic " + btoa(`${user}:${pass}`);
}

async function errorFromResponse(res: Response, prefix: string): Promise<Error> {
  let detail = "";
  try {
    const text = await res.text();
    if (text) {
      try {
        const body = JSON.parse(text);
        if (typeof body?.detail === "string") {
          detail = body.detail;
        } else if (body?.detail != null) {
          detail = JSON.stringify(body.detail);
        } else if (typeof body?.message === "string") {
          detail = body.message;
        } else {
          detail = text;
        }
      } catch {
        detail = text;
      }
    }
  } catch {
    // network/stream read failure — fall through to the status line
  }
  detail = detail.trim();
  return new Error(detail || `${prefix} (${res.status} ${res.statusText})`.trim());
}

async function fetchWithBasicAuth(
  input: RequestInfo | URL,
  init: RequestInit
): Promise<Response> {
  const withAuth = (): RequestInit => ({
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: authHeader() },
  });

  const first = await fetch(input, withAuth());
  if (first.status !== 401) {
    return first;
  }
  clearCredentials();
  return fetch(input, withAuth());
}

export function startGenerationStream(
  files: File[],
  params: GenerateParams,
  onEvent: (e: SSEEvent) => void,
  onError: (err: Error) => void
): () => void {
  const controller = new AbortController();
  const form = new FormData();
  for (const file of files) form.append("files", file);
  form.append("params", JSON.stringify(params));

  fetchWithBasicAuth(`${BASE}/qa/generate`, {
    method: "POST",
    body: form,
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        onError(await errorFromResponse(res, "Server error"));
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (line) {
            try {
              onEvent(JSON.parse(line.slice(6)));
            } catch {
              // skip malformed line
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err as Error);
    });

  return () => controller.abort();
}

export async function sendChatMessage(args: {
  jobId: string;
  mode: "mcq" | "flashcards";
  message: string;
  history: ChatMessage[];
  currentMcqs: MCQ[];
  currentFlashcards: Flashcard[];
  variant?: MCQVariant;
  /** Data URLs of image(s) to attach to this message (mcq mode only). */
  images?: string[];
  /** Reference questions for the trial second pass (HQ, else MCQ). */
  referenceMcqs?: MCQ[];
}): Promise<ChatResponse> {
  const res = await fetchWithBasicAuth(`${BASE}/qa/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_id: args.jobId,
      mode: args.mode,
      message: args.message,
      history: args.history,
      current_mcqs: args.currentMcqs,
      current_flashcards: args.currentFlashcards,
      variant: args.variant ?? null,
      images: args.images ?? [],
      reference_mcqs: args.referenceMcqs ?? [],
    }),
  });
  if (!res.ok) throw await errorFromResponse(res, "Chat error");
  return (await res.json()) as ChatResponse;
}

/** Generate a single section on demand (any tab) for an existing job.
 *  `referenceMcqs` is the trial second pass's reference set (HQ, else MCQ);
 *  ignored by the backend for non-trial sections. */
export async function generateSection(
  jobId: string,
  section: Tab,
  targetCount?: number,
  adaptive = false,
  referenceMcqs: MCQ[] = []
): Promise<GenerateSectionResponse> {
  const res = await fetchWithBasicAuth(`${BASE}/qa/generate-section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      section,
      target_count: adaptive ? null : targetCount ?? null,
      adaptive,
      reference_mcqs: referenceMcqs,
    }),
  });
  if (!res.ok) throw await errorFromResponse(res, "Section error");
  return (await res.json()) as GenerateSectionResponse;
}

// Chat-attached images become tagged markdown images so the export is self-contained.
function formatImageMarkdown(images?: string[]): string {
  if (!images?.length) return "";
  return (
    "\n\n" +
    images.map((src, i) => `![Question image ${i + 1}](${src})`).join("\n\n")
  );
}

// Un marqueur Vrai/Faux que le modèle a laissé au début de la justification.
// Le séparateur est obligatoire, sinon "Vraisemblablement…" serait tronqué.
const LEADING_VERDICT_RE = /^\s*(?:vrai|faux|true|false)\b\s*[-–—:.]\s*/i;

// Original QCM schema for the internal variants (hq / trial / qcu / exercise);
// it feeds an import system, so keep the headings and structure exactly.
//
// The importer (MediSuccess-Front `components/admin/**/CreateQCM*.tsx`) reads a
// correction line with /^([A-K])\.\s*(Vrai|Faux)\s*[-–—]\s*(.*)$/ and derives
// `correct_answers` from the "Vrai" markers. A line without the marker matches
// nothing, so the whole correction AND the answer key are dropped silently —
// the marker below is what makes the export importable, not decoration.
export function mcqImportMarkdown(mcqs: GenerateResponse["mcqs"]): string {
  return mcqs
    .map((q) => {
      const options = q.options
        .map((o) => `${o.label}. ${o.text}`)
        .join("\n");
      const corrections = q.options
        .map((o) => {
          // The verdict is carried structurally by `is_correct`; the validator
          // normally strips it out of the justification text, but strip it again
          // here so a leaked marker is not doubled ("A. Vrai - Vrai – …").
          const verdict = o.is_correct ? "Vrai" : "Faux";
          const text = o.justification.replace(LEADING_VERDICT_RE, "").trim();
          return `${o.label}. ${verdict} - ${text}`;
        })
        .join("\n");
      const imageMd = formatImageMarkdown(q.images);
      return (
        `# Question\n${q.question}${imageMd}\n\n` +
        `# Réponses\n${options}\n\n` +
        `# Corrections\n${corrections}`
      );
    })
    .join("\n\n");
}

// Generic, language-neutral format for the normal `mcq` tab.
export function mcqMarkdown(mcqs: GenerateResponse["mcqs"]): string {
  return mcqs
    .map((q, i) => {
      const options = q.options
        .map((o) => `- ${o.label}. ${o.text}`)
        .join("\n");
      const answer =
        q.options
          .filter((o) => o.is_correct)
          .map((o) => o.label)
          .join(", ") || "—";
      const justifications = q.options
        .map((o) => `- ${o.label}. ${o.justification}`)
        .join("\n");
      const imageMd = formatImageMarkdown(q.images);
      return (
        `## Question ${i + 1}\n\n${q.question}${imageMd}\n\n` +
        `${options}\n\n` +
        `**Answer:** ${answer}\n\n` +
        `**Justifications:**\n${justifications}`
      );
    })
    .join("\n\n");
}

export function flashcardMarkdown(
  flashcards: GenerateResponse["flashcards"]
): string {
  const parts: string[] = ["# Flashcards\n"];
  let currentSource: string | null | undefined = undefined;
  flashcards.forEach((f, i) => {
    const source = f.source ?? null;
    if (source !== currentSource) {
      currentSource = source;
      if (source) parts.push(`## ${source}`);
    }
    parts.push(`### #${String(i + 1).padStart(2, "0")} ${f.front}\n\n${f.back}`);
  });
  return parts.join("\n\n");
}

/** Markdown for a single tab, in that tab's correct format. */
export function tabMarkdown(
  tab: Tab,
  mcqs: GenerateResponse["mcqs"],
  flashcards: GenerateResponse["flashcards"]
): string {
  if (tab === "flashcards") return flashcardMarkdown(flashcards);
  // Internal variants feed an import system and must keep the original QCM
  // schema; only the normal `mcq` tab uses the generic format.
  if (tab === "mcq") return mcqMarkdown(mcqs);
  return mcqImportMarkdown(mcqs);
}

export function downloadTabMarkdown(
  tab: Tab,
  mcqs: GenerateResponse["mcqs"],
  flashcards: GenerateResponse["flashcards"],
  topic: string
) {
  const md = tabMarkdown(tab, mcqs, flashcards);
  // Prepend a UTF-8 BOM so Word (and other Windows tools) auto-detect the
  // encoding instead of falling back to a legacy codepage. Without it,
  // accented characters open garbled until the user manually picks UTF-8.
  const blob = new Blob(["\uFEFF", md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = topic.replace(/\s+/g, "-").toLowerCase() || "generated";
  const tabSlug = TABS.find((t) => t.id === tab)?.slug ?? tab;
  a.download = `qa-${slug}-${tabSlug}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
