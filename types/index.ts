export interface MCQOption {
  label: "A" | "B" | "C" | "D";
  text: string;
}

export interface MCQ {
  id: string;
  question: string;
  options: MCQOption[];
  correct_answer: "A" | "B" | "C" | "D";
  explanation: string;
  source_reference?: string;
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
}

export interface GenerateResponse {
  job_id: string;
  mcqs: MCQ[];
  flashcards: Flashcard[];
}

export interface SSEEvent {
  type: "progress" | "result" | "error";
  step?: number;
  total_steps?: number;
  message?: string;
  data?: GenerateResponse;
}

export type GenerationPhase = "idle" | "loading" | "done" | "error";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatResponse {
  message: string;
  mcqs?: MCQ[];
  flashcards?: Flashcard[];
}
