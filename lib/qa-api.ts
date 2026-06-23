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

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const USER = process.env.NEXT_PUBLIC_QA_USER ?? "medisuccess";
const PASS = process.env.NEXT_PUBLIC_QA_PASS ?? "";

let promptedUser: string | null = null;
let promptedPass: string | null = null;

function hasStaticCredentials(): boolean {
  return USER.trim().length > 0 && PASS.trim().length > 0;
}

function clearPromptedCredentials() {
  promptedUser = null;
  promptedPass = null;
}

function ensurePromptedCredentials(): { user: string; pass: string } {
  if (promptedUser !== null && promptedPass !== null) {
    return { user: promptedUser, pass: promptedPass };
  }

  if (typeof window === "undefined") {
    throw new Error("Missing API credentials for basic auth");
  }

  const user = window.prompt("API username", USER)?.trim() ?? "";
  const pass = window.prompt("API password") ?? "";

  if (!user || !pass) {
    throw new Error("Basic auth credentials are required");
  }

  promptedUser = user;
  promptedPass = pass;
  return { user, pass };
}

function authHeader(): string {
  if (hasStaticCredentials()) {
    return "Basic " + btoa(`${USER}:${PASS}`);
  }
  const { user, pass } = ensurePromptedCredentials();
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
  const first = await fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: authHeader(),
    },
  });

  if (first.status !== 401 || hasStaticCredentials()) {
    return first;
  }

  clearPromptedCredentials();
  const retried = await fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: authHeader(),
    },
  });
  return retried;
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
      // A question built from chat image(s) carries each as a tagged markdown
      // image (data URL) so the exported file stays self-contained.
      const imageMd = q.images?.length
        ? "\n\n" +
          q.images
            .map((src, idx) => `![Question image ${idx + 1}](${src})`)
            .join("\n\n")
        : "";
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
  return tab === "flashcards"
    ? flashcardMarkdown(flashcards)
    : mcqMarkdown(mcqs);
}

const TAB_FILE_SLUG: Record<Tab, string> = {
  mcq: "mcq",
  flashcards: "flashcards",
  hq: "mcq-hq",
  trial: "trial",
  qcu: "qcu",
  exercise: "exercises",
};

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
  a.download = `qa-${slug}-${TAB_FILE_SLUG[tab]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
