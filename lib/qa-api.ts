import type {
  ChatMessage,
  ChatResponse,
  Flashcard,
  GenerateParams,
  GenerateResponse,
  MCQ,
  SSEEvent,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const USER = process.env.NEXT_PUBLIC_QA_USER ?? "medisuccess";
const PASS = process.env.NEXT_PUBLIC_QA_PASS ?? "";

function authHeader(): string {
  return "Basic " + btoa(`${USER}:${PASS}`);
}

export function startGenerationStream(
  file: File | null,
  params: GenerateParams,
  onEvent: (e: SSEEvent) => void,
  onError: (err: Error) => void
): () => void {
  const controller = new AbortController();
  const form = new FormData();
  if (file) form.append("file", file);
  form.append("params", JSON.stringify(params));

  fetch(`${BASE}/qa/generate`, {
    method: "POST",
    headers: { Authorization: authHeader() },
    body: form,
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        onError(new Error(`Server error ${res.status}`));
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
}): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/qa/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      job_id: args.jobId,
      mode: args.mode,
      message: args.message,
      history: args.history,
      current_mcqs: args.currentMcqs,
      current_flashcards: args.currentFlashcards,
    }),
  });
  if (!res.ok) throw new Error(`Chat error ${res.status}`);
  return (await res.json()) as ChatResponse;
}

export function generateMarkdown(
  mcqs: GenerateResponse["mcqs"],
  flashcards: GenerateResponse["flashcards"]
): string {
  const mcqSection = [
    "# Questions à choix multiples\n",
    ...mcqs.map(
      (q, i) =>
        `## Q${i + 1}. ${q.question}\n\n` +
        q.options.map((o) => `- **${o.label}.** ${o.text}`).join("\n") +
        `\n\n**Réponse : ${q.correct_answer}**\n\n> ${q.explanation}` +
        (q.source_reference ? `\n\n*Source : ${q.source_reference}*` : "")
    ),
  ].join("\n\n");

  const fcSection = [
    "\n---\n\n# Flashcards\n",
    ...flashcards.map(
      (f, i) =>
        `### #${String(i + 1).padStart(2, "0")} ${f.front}\n\n${f.back}`
    ),
  ].join("\n\n");

  return mcqSection + fcSection;
}

export function downloadMarkdown(
  mcqs: GenerateResponse["mcqs"],
  flashcards: GenerateResponse["flashcards"],
  topic: string
) {
  const md = generateMarkdown(mcqs, flashcards);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qa-${topic.replace(/\s+/g, "-").toLowerCase() || "generated"}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
