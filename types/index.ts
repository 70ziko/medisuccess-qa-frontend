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
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
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
  hq_adaptive: boolean;
  trial_adaptive: boolean;
  qcu_adaptive: boolean;
}

export interface GenerateResponse {
  job_id: string;
  mcqs: MCQ[];
  flashcards: Flashcard[];
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
}

export interface ChatResponse {
  message: string;
  mcqs?: MCQ[];
  flashcards?: Flashcard[];
}

export type MCQVariant = "hq" | "trial" | "qcu";

export type Tab = "mcq" | "flashcards" | MCQVariant;

export interface GenerateVariantResponse {
  variant: MCQVariant;
  mcqs: MCQ[];
}

/** Maps a variant tab to its count field in GenerateParams. */
export const VARIANT_COUNT_KEY: Record<
  MCQVariant,
  "hq_count" | "trial_count" | "qcu_count"
> = {
  hq: "hq_count",
  trial: "trial_count",
  qcu: "qcu_count",
};

/** Maps a variant tab to its adaptive ("Auto") flag in GenerateParams. */
export const VARIANT_ADAPTIVE_KEY: Record<
  MCQVariant,
  "hq_adaptive" | "trial_adaptive" | "qcu_adaptive"
> = {
  hq: "hq_adaptive",
  trial: "trial_adaptive",
  qcu: "qcu_adaptive",
};
