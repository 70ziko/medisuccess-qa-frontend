"use client";

import { useCallback, useState } from "react";
import type {
  ChatMessage,
  Flashcard,
  GenerateParams,
  GenerationPhase,
  MCQ,
} from "@/types";
import { sendChatMessage, startGenerationStream } from "@/lib/qa-api";
import { PDFDropzone } from "./PDFDropzone";
import { ParamsForm } from "./ParamsForm";
import { GenerationProgress } from "./GenerationProgress";
import { MCQCard } from "./MCQCard";
import { FlashcardItem } from "./FlashcardItem";
import { OutputToolbar } from "./OutputToolbar";
import { ChatBar } from "./ChatBar";
import { Icon, LoaderDots } from "./Icons";

const DEFAULT_PARAMS: GenerateParams = {
  topic: "",
  language: "fr",
  difficulty: "intermediate",
  mcq_count: 10,
  flashcard_count: 10,
};

export function QAGeneratorApp() {
  const [file, setFile] = useState<File | null>(null);
  const [params, setParams] = useState<GenerateParams>(DEFAULT_PARAMS);
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [progressStep, setProgressStep] = useState(0);
  const [progressTotal, setProgressTotal] = useState(5);
  const [progressMsg, setProgressMsg] = useState("");
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [jobId, setJobId] = useState<string>("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"mcq" | "flashcards">("mcq");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isReady = file !== null || params.topic.trim().length > 0;

  const handleGenerate = useCallback(() => {
    if (!isReady) return;
    setPhase("loading");
    setRevealedIds(new Set());
    setChatHistory([]);
    setProgressStep(0);
    setProgressMsg("Initialisation…");

    const stop = startGenerationStream(
      file,
      params,
      (event) => {
        if (event.type === "progress") {
          setProgressStep(event.step ?? 0);
          setProgressTotal(event.total_steps ?? 5);
          setProgressMsg(event.message ?? "");
        } else if (event.type === "result" && event.data) {
          setMcqs(event.data.mcqs);
          setFlashcards(event.data.flashcards);
          setJobId(event.data.job_id);
          setPhase("done");
        } else if (event.type === "error") {
          setErrorMsg(event.message ?? "Unknown error");
          setPhase("error");
        }
      },
      (err) => {
        setErrorMsg(err.message);
        setPhase("error");
      }
    );

    return stop;
  }, [file, params, isReady]);

  const handleChatSend = async (message: string) => {
    setChatHistory((h) => [...h, { role: "user", text: message }]);
    setChatLoading(true);
    try {
      const reply = await sendChatMessage({
        jobId,
        mode: activeTab,
        message,
        history: chatHistory,
        currentMcqs: mcqs,
        currentFlashcards: flashcards,
      });
      if (reply.mcqs) setMcqs(reply.mcqs);
      if (reply.flashcards) setFlashcards(reply.flashcards);
      setRevealedIds(new Set());
      setChatHistory((h) => [
        ...h,
        { role: "assistant", text: reply.message },
      ]);
    } catch {
      setChatHistory((h) => [
        ...h,
        { role: "assistant", text: "Une erreur est survenue." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClear = () => {
    setPhase("idle");
    setFile(null);
    setMcqs([]);
    setFlashcards([]);
    setChatHistory([]);
    setRevealedIds(new Set());
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
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
        {/* Logo */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 9,
          }}
        >
          <span style={{ color: "var(--accent)" }}>
            <Icon name="logo" size={20} />
          </span>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13.5,
                letterSpacing: "-0.01em",
              }}
            >
              MediSuccess
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.02em",
              }}
            >
              Q&A Generator
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "18px 20px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <PDFDropzone file={file} onChange={setFile} />
          <ParamsForm params={params} onChange={setParams} />

          <button
            onClick={handleGenerate}
            disabled={!isReady || phase === "loading"}
            style={{
              marginTop: "auto",
              padding: "11px 0",
              borderRadius: "var(--radius)",
              background: isReady ? "var(--accent)" : "var(--border)",
              color: isReady ? "#fff" : "var(--text-muted)",
              border: "none",
              fontFamily: "var(--font)",
              fontSize: 14,
              fontWeight: 600,
              cursor: isReady ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              transition: "all .2s ease",
              letterSpacing: "-0.01em",
            }}
          >
            {phase === "loading" ? (
              <LoaderDots />
            ) : (
              <>
                <Icon name="sparkle" size={14} />
                Generate
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {phase === "idle" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 12,
              color: "var(--text-muted)",
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
              <Icon name="sparkle" size={22} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>
              Upload a PDF or enter a topic to get started
            </p>
            <p style={{ fontSize: 12.5 }}>MCQ and flashcards will appear here</p>
          </div>
        )}

        {phase === "loading" && (
          <GenerationProgress
            step={progressStep}
            totalSteps={progressTotal}
            message={progressMsg}
          />
        )}

        {phase === "error" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 12,
              color: "var(--red)",
              padding: 32,
              textAlign: "center",
            }}
          >
            <p style={{ fontWeight: 500 }}>Generation failed</p>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {errorMsg}
            </p>
            <button
              onClick={() => setPhase("idle")}
              style={{
                marginTop: 8,
                padding: "8px 20px",
                borderRadius: 7,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "var(--font)",
              }}
            >
              Try again
            </button>
          </div>
        )}

        {phase === "done" && (
          <>
            <OutputToolbar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              mcqs={mcqs}
              flashcards={flashcards}
              revealedCount={revealedIds.size}
              topic={params.topic}
              onClear={handleClear}
            />

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "18px 22px",
                }}
              >
                {activeTab === "mcq" &&
                  mcqs.map((item, i) => (
                    <MCQCard
                      key={item.id}
                      item={item}
                      index={i}
                      revealed={revealedIds.has(item.id)}
                      onReveal={(id) =>
                        setRevealedIds((s) => new Set(Array.from(s).concat(id)))
                      }
                    />
                  ))}

                {activeTab === "flashcards" && (
                  <>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        marginBottom: 12,
                      }}
                    >
                      Click any card to reveal the answer
                    </p>
                    {flashcards.map((item, i) => (
                      <FlashcardItem key={item.id} item={item} index={i} />
                    ))}
                  </>
                )}
              </div>

              <ChatBar
                history={chatHistory}
                loading={chatLoading}
                onSend={handleChatSend}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
