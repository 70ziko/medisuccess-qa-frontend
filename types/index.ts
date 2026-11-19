export type MCQLabel = "A" | "B" | "C" | "D" | "E";

export interface MCQOption {
  label: MCQLabel;
  text: string;
  is_correct: boolean;
  justification: string;
}

export interface MCQ {
  id: string;
  question: string;
  options: MCQOption[];
  /** Data URLs of image(s) attached to this question via chat refinement. */
  images?: string[];
  /** Item type inside a mixed trial set; null/absent everywhere else. */
  kind?: MCQKind | null;
}

export type MCQKind = "qcm" | "qcu" | "exercise";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  /** Originating filename when generated from an uploaded document.
   *  Null/absent for topic-only generation or items added via chat. */
  source?: string | null;
}

export interface GenerateParams {
  topic: string;
  language: "fr" | "en";
  difficulty: "easy" | "intermediate" | "hard";
  mcq_count: number;
  flashcard_count: number;
  mcq_adaptive: boolean;
  flashcard_adaptive: boolean;
  // Per-variant target counts for the on-demand variant tabs.
  hq_count: number;
  trial_count: number;
  qcu_count: number;
  exercise_count: number;
  hq_adaptive: boolean;
  trial_adaptive: boolean;
  qcu_adaptive: boolean;
  exercise_adaptive: boolean;
  // Run flashcards in parallel with question generation and skip injecting
  // flashcards into MCQ/variant prompts.
  parallelize_flashcards: boolean;
  // Per-section "generate on the first pass?" toggles. Sections left off are
  // generated later on demand via the per-tab Generate button.
  mcq_enabled: boolean;
  flashcard_enabled: boolean;
  hq_enabled: boolean;
  trial_enabled: boolean;
  qcu_enabled: boolean;
  exercise_enabled: boolean;
}

export interface GenerateResponse {
  job_id: string;
  mcqs: MCQ[];
  flashcards: Flashcard[];
}

export interface ModelTokens {
  input: number;
  output: number;
  total: number;
  cost: number; // USD
}

export interface StageTokens {
  input: number;
  output: number;
  total: number;
  by_model: Record<string, ModelTokens>;
}

export interface TokenUsage {
  stages: Record<string, StageTokens>;
  by_model: Record<string, ModelTokens>;
  total: {
    input: number;
    output: number;
    total: number;
    cost: number; // USD
  };
}

export type SSEEvent =
  | {
      type: "progress";
      step?: number;
      total_steps?: number;
      message?: string;
    }
  | { type: "result"; data: GenerateResponse }
  | { type: "flashcards_partial"; data: Flashcard[] }
  | { type: "mcq_partial"; data: MCQ[] }
  | { type: "mcq_result"; data: MCQ[] }
  | { type: "variant_result"; variant: MCQVariant; data: MCQ[] }
  | { type: "tokens_update"; data: TokenUsage }
  | { type: "error"; message?: string };

export type GenerationPhase =
  | "idle"
  | "loading"
  | "streaming"
  | "done"
  | "error";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** Data URLs of image(s) the user attached to this message (user role). */
  images?: string[];
}

export interface ChatResponse {
  message: string;
  mcqs?: MCQ[];
  flashcards?: Flashcard[];
}

export type MCQVariant = "hq" | "trial" | "qcu" | "exercise";

export type Tab = "mcq" | "flashcards" | MCQVariant;

export interface TabMeta {
  id: Tab;
  label: string;
  /** Filename slug for the per-tab markdown download. */
  slug: string;
  /** Active-tab pill colours. */
  color: { bg: string; text: string };
}

/** Single source of truth for the output tabs — order, labels, download slugs,
 *  and active colours. Consumed by the toolbar, the app shell, and the export
 *  helpers so a new tab only has to be described once. */
export const TABS: TabMeta[] = [
  { id: "mcq", label: "MCQ", slug: "mcq", color: { bg: "#ffedd5", text: "#c2410c" } },
  { id: "flashcards", label: "Flashcards", slug: "flashcards", color: { bg: "#dbeafe", text: "#1d4ed8" } },
  { id: "hq", label: "MCQ – HQ", slug: "mcq-hq", color: { bg: "#ede9fe", text: "#6d28d9" } },
  { id: "trial", label: "Trial", slug: "trial", color: { bg: "#dcfce7", text: "#15803d" } },
  { id: "qcu", label: "QCU", slug: "qcu", color: { bg: "#fce7f3", text: "#be185d" } },
  { id: "exercise", label: "Exercises", slug: "exercises", color: { bg: "#fef9c3", text: "#a16207" } },
];

/** On-demand generation of a single section. Exactly one of the result fields
 *  is populated, depending on the section kind. */
export interface GenerateSectionResponse {
  section: Tab;
  mcqs?: MCQ[];
  flashcards?: Flashcard[];
}

/** Maps any tab to its count field in GenerateParams. */
export const TAB_COUNT_KEY: Record<
  Tab,
  | "mcq_count"
  | "flashcard_count"
  | "hq_count"
  | "trial_count"
  | "qcu_count"
  | "exercise_count"
> = {
  mcq: "mcq_count",
  flashcards: "flashcard_count",
  hq: "hq_count",
  trial: "trial_count",
  qcu: "qcu_count",
  exercise: "exercise_count",
};

/** Maps any tab to its adaptive ("Auto") flag in GenerateParams. */
export const TAB_ADAPTIVE_KEY: Record<
  Tab,
  | "mcq_adaptive"
  | "flashcard_adaptive"
  | "hq_adaptive"
  | "trial_adaptive"
  | "qcu_adaptive"
  | "exercise_adaptive"
> = {
  mcq: "mcq_adaptive",
  flashcards: "flashcard_adaptive",
  hq: "hq_adaptive",
  trial: "trial_adaptive",
  qcu: "qcu_adaptive",
  exercise: "exercise_adaptive",
};

/** Maps any tab to its "generate on first pass?" flag in GenerateParams. */
export const TAB_ENABLED_KEY: Record<
  Tab,
  | "mcq_enabled"
  | "flashcard_enabled"
  | "hq_enabled"
  | "trial_enabled"
  | "qcu_enabled"
  | "exercise_enabled"
> = {
  mcq: "mcq_enabled",
  flashcards: "flashcard_enabled",
  hq: "hq_enabled",
  trial: "trial_enabled",
  qcu: "qcu_enabled",
  exercise: "exercise_enabled",
};

// ── Numbered diagrams (/qa/diagrams) ───────────────────────────────────────

/** One callout: the number printed on the image and the structure it names. */
export interface DiagramLegendEntry {
  numero: number;
  label: string;
}

export interface DiagramAttempt {
  attempt: number;
  issues: string[];
  error: string | null;
  error_code: string | null;
  /** OpenAI's id for a failed call; its support asks for it. */
  request_id?: string | null;
}

/** Present when OpenAI's safety filter refused at least one redraw of this diagram. */
export interface DiagramModeration {
  blocked: number;
  /** Blocks tolerated before the numbered source is returned. */
  max_blocked: number;
  /** Categories OpenAI named (e.g. "sexual"); empty when it gave none. */
  reasons: string[];
  request_ids: string[];
}

export interface DiagramResult {
  /** "verified": the redraw passed the number-by-number check.
   *  "source_fallback": no redraw passed; `image` is the numbered source.
   *  "numbers_only": no redraw asked for; `image` is the numbered source, turned upright. */
  status: "verified" | "source_fallback" | "numbers_only";
  /** PNG data URL of the returned image. */
  image: string;
  /** Closest unverified redraw, only on "source_fallback". */
  redraw_image: string | null;
  /** Numbers placed by code on the upright source, only on "verified" (otherwise it already is `image`). */
  numbered_image?: string | null;
  legend: DiagramLegendEntry[];
  warnings: string[];
  kept_text: string[];
  attempts: DiagramAttempt[];
  moderation: DiagramModeration | null;
  /** Debug only (Boxes tab): remove with backend app/pipeline/diagram_debug.py. */
  debug?: DiagramDebug;
  rotation_clockwise: number;
  usage: TokenUsage;
  seconds: number;
  /** Sent back untouched with every follow-up run (chat, AI redraw), so the server can restart mid-pipeline. */
  state: DiagramState | null;
  /** After a follow-up run: the assistant's answer and the step the run restarted from. */
  reply?: string;
  entry?: DiagramEntry;
}

/** The server's reading of one drawing. Opaque here except for the chat's standing instructions. */
export interface DiagramState {
  read_notes: string[];
  redraw_notes: string[];
  role_overrides: unknown[];
  added_markers: unknown[];
  [key: string]: unknown;
}

/** The pipeline step a follow-up run restarted from; "answer" and "legend" do no image work. */
export type DiagramEntry = "answer" | "legend" | "redraw" | "number" | "read" | "orient";

export interface DiagramChatTurn {
  role: "user" | "assistant";
  text: string;
  /** Assistant turns: where the run restarted. */
  entry?: DiagramEntry;
}

export interface DiagramError {
  message: string;
  code: string;
  /** Running the same image again may succeed (rate limit, refusal, flag…). */
  retryable: boolean;
  request_id?: string | null;
}

export type DiagramStage =
  | "queued"
  | "route"
  | "routed"
  | "orient"
  | "text"
  | "reread"
  | "axes"
  | "numbered"
  | "redraw"
  | "blocked"
  | "redraw_failed"
  | "verify"
  | "checked";

export type DiagramEvent =
  | {
      type: "progress";
      stage: DiagramStage;
      message: string;
      attempt?: number;
      max_attempts?: number;
      labels?: number;
      issues?: string[];
      /** "routed": where the follow-up run restarts, and whether it does any image work. */
      entry?: DiagramEntry;
      reply?: string;
      runs?: boolean;
    }
  | { type: "diagram_result"; data: DiagramResult }
  /** A follow-up run that needed no image work: the images stay as they are. */
  | {
      type: "diagram_reply";
      message: string;
      entry: DiagramEntry;
      legend: DiagramLegendEntry[];
      state: DiagramState;
      usage: TokenUsage;
    }
  | ({ type: "error"; usage?: TokenUsage } & DiagramError);

// Debug only: the reading step's boxes (components/DiagramBoxes.tsx).
export interface DiagramDebugItem {
  text: string;
  role: "label" | "keep" | "remove";
  /** [x0, y0, x1, y1] in pixels of the upright `width`×`height` frame. */
  box: [number, number, number, number];
  anchor: string;
  panel: number;
  legend: string;
  numero: number | null;
  /** Second reading outcome: "misaimed", "blank", "changed". */
  flags: string[];
  second_reading: string | null;
  first_reading?: string;
}

export interface DiagramDebug {
  width: number;
  height: number;
  box_scale: [number, number];
  dropped: string[];
  source_image: string;
  stamped_image: string;
  items: DiagramDebugItem[];
}
