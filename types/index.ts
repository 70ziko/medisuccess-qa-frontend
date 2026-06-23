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
}

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

/** On-demand generation of a single section. Exactly one of the result fields
 *  is populated, depending on the section kind. */
export interface GenerateSectionResponse {
  section: Tab;
  mcqs?: MCQ[];
  flashcards?: Flashcard[];
}

/** Maps a variant tab to its count field in GenerateParams. */
export const VARIANT_COUNT_KEY: Record<
  MCQVariant,
  "hq_count" | "trial_count" | "qcu_count" | "exercise_count"
> = {
  hq: "hq_count",
  trial: "trial_count",
  qcu: "qcu_count",
  exercise: "exercise_count",
};

/** Maps a variant tab to its adaptive ("Auto") flag in GenerateParams. */
export const VARIANT_ADAPTIVE_KEY: Record<
  MCQVariant,
  "hq_adaptive" | "trial_adaptive" | "qcu_adaptive" | "exercise_adaptive"
> = {
  hq: "hq_adaptive",
  trial: "trial_adaptive",
  qcu: "qcu_adaptive",
  exercise: "exercise_adaptive",
};

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
