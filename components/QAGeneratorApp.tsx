"use client";

import { useCallback, useState } from "react";
import type {
  ChatMessage,
  Flashcard,
  GenerateParams,
  GenerationPhase,
  MCQ,
  MCQVariant,
  Tab,
} from "@/types";
import { VARIANT_ADAPTIVE_KEY, VARIANT_COUNT_KEY } from "@/types";
import {
  generateVariant,
  sendChatMessage,
  startGenerationStream,
} from "@/lib/qa-api";
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
  mcq_adaptive: false,
  flashcard_adaptive: false,
  hq_count: 10,
  trial_count: 6,
  qcu_count: 10,
  hq_adaptive: false,
  trial_adaptive: false,
  qcu_adaptive: false,
};

const ALL_TABS: Tab[] = ["mcq", "flashcards", "hq", "trial", "qcu"];

const emptyHistories = (): Record<Tab, ChatMessage[]> =>
  Object.fromEntries(ALL_TABS.map((t) => [t, [] as ChatMessage[]])) as Record<
    Tab,
    ChatMessage[]
  >;

const emptyLoading = (): Record<Tab, boolean> =>
  Object.fromEntries(ALL_TABS.map((t) => [t, false])) as Record<Tab, boolean>;

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
  const [activeTab, setActiveTab] = useState<Tab>("mcq");
  const [chatHistories, setChatHistories] = useState<Record<Tab, ChatMessage[]>>(
    emptyHistories
  );
  const [chatLoadingTab, setChatLoadingTab] = useState<Record<Tab, boolean>>(
    emptyLoading
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [variantMcqs, setVariantMcqs] = useState<Record<MCQVariant, MCQ[]>>({
    hq: [],
    trial: [],
    qcu: [],
  });
  const [variantLoading, setVariantLoading] = useState<Record<MCQVariant, boolean>>(
    { hq: false, trial: false, qcu: false }
  );

  const isVariantTab = (t: Tab): t is MCQVariant =>
    t === "hq" || t === "trial" || t === "qcu";

  const runVariant = useCallback(
    (t: MCQVariant) => {
      if (!jobId) return;
      setVariantLoading((s) => ({ ...s, [t]: true }));
      generateVariant(
        jobId,
        t,
        params[VARIANT_COUNT_KEY[t]],
        params[VARIANT_ADAPTIVE_KEY[t]]
      )
        .then((res) => setVariantMcqs((s) => ({ ...s, [t]: res.mcqs })))
        .catch((err: Error) => setErrorMsg(err.message))
        .finally(() => setVariantLoading((s) => ({ ...s, [t]: false })));
    },
    [jobId, params]
  );

  const handleTabChange = useCallback(
    (t: Tab) => {
      setActiveTab(t);
      if (!isVariantTab(t)) return;
      if (variantMcqs[t].length > 0 || variantLoading[t]) return;
      runVariant(t);
    },
    [variantMcqs, variantLoading, runVariant]
  );

  const isReady = file !== null || params.topic.trim().length > 0;

  const handleGenerate = useCallback(() => {
    if (!isReady) return;
    setPhase("loading");
    setRevealedIds(new Set());
    setChatHistories(emptyHistories());
    setChatLoadingTab(emptyLoading());
    setProgressStep(0);
    setProgressMsg("Initialisation…");

    setMcqs([]);
    setFlashcards([]);
    setVariantMcqs({ hq: [], trial: [], qcu: [] });

    const stop = startGenerationStream(
      file,
      params,
      (event) => {
        if (event.type === "progress") {
          setProgressStep(event.step ?? 0);
          setProgressTotal(event.total_steps ?? 5);
          setProgressMsg(event.message ?? "");
        } else if (event.type === "flashcards_partial") {
          setFlashcards((prev) => [...prev, ...event.data]);
          setPhase((p) => (p === "loading" ? "streaming" : p));
          setActiveTab((t) => (t === "mcq" ? "flashcards" : t));
        } else if (event.type === "result") {
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
    // Snapshot the tab so the reply lands on the thread it was sent from,
    // even if the user switches tabs mid-request.
    const tab = activeTab;
    const variant = isVariantTab(tab) ? tab : undefined;
    const tabMcqs = variant ? variantMcqs[variant] : mcqs;
    const appendToTab = (msg: ChatMessage) =>
      setChatHistories((h) => ({ ...h, [tab]: [...h[tab], msg] }));

    appendToTab({ role: "user", text: message });
    setChatLoadingTab((s) => ({ ...s, [tab]: true }));
    try {
      const reply = await sendChatMessage({
        jobId,
        mode: tab === "flashcards" ? "flashcards" : "mcq",
        message,
        history: chatHistories[tab],
        currentMcqs: tabMcqs,
        currentFlashcards: flashcards,
        variant,
      });
      if (reply.mcqs) {
        if (variant) {
          setVariantMcqs((s) => ({ ...s, [variant]: reply.mcqs! }));
        } else {
          setMcqs(reply.mcqs);
        }
      }
      if (reply.flashcards) setFlashcards(reply.flashcards);
      setRevealedIds(new Set());
      appendToTab({ role: "assistant", text: reply.message });
    } catch {
      appendToTab({ role: "assistant", text: "Une erreur est survenue." });
    } finally {
      setChatLoadingTab((s) => ({ ...s, [tab]: false }));
    }
  };

  const handleClear = () => {
    setPhase("idle");
    setFile(null);
    setMcqs([]);
    setFlashcards([]);
    setChatHistories(emptyHistories());
    setChatLoadingTab(emptyLoading());
    setRevealedIds(new Set());
    setVariantMcqs({ hq: [], trial: [], qcu: [] });
    setVariantLoading({ hq: false, trial: false, qcu: false });
    setActiveTab("mcq");
  };

  // MCQ list backing the active tab (variant tabs have their own list).
  const activeMcqs = isVariantTab(activeTab) ? variantMcqs[activeTab] : mcqs;

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
            disabled={!isReady || phase === "loading" || phase === "streaming"}
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
            {phase === "loading" || phase === "streaming" ? (
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

        {(phase === "done" || phase === "streaming") && (
          <>
            <OutputToolbar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              activeMcqs={activeMcqs}
              flashcards={flashcards}
              revealedCount={revealedIds.size}
              topic={params.topic}
              onClear={handleClear}
              onRegenerate={
                isVariantTab(activeTab)
                  ? () => runVariant(activeTab)
                  : undefined
              }
              regenerating={
                isVariantTab(activeTab) ? variantLoading[activeTab] : false
              }
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
                  (phase === "streaming" ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        padding: "48px 0",
                        color: "var(--text-muted)",
                        fontSize: 13,
                      }}
                    >
                      <LoaderDots />
                      <span>
                        {params.language === "fr"
                          ? "Génération des questions…"
                          : "Generating questions…"}
                      </span>
                    </div>
                  ) : (
                    mcqs.map((item, i) => (
                      <MCQCard
                        key={item.id}
                        item={item}
                        index={i}
                        revealed={revealedIds.has(item.id)}
                        onReveal={(id) =>
                          setRevealedIds((s) =>
                            new Set(Array.from(s).concat(id))
                          )
                        }
                      />
                    ))
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
                      {phase === "streaming"
                        ? params.language === "fr"
                          ? "Les cartes apparaissent pendant la génération des questions…"
                          : "Cards appear as questions are generated…"
                        : "Click any card to reveal the answer"}
                    </p>
                    {flashcards.map((item, i) => (
                      <FlashcardItem key={item.id} item={item} index={i} />
                    ))}
                  </>
                )}

                {isVariantTab(activeTab) &&
                  (variantLoading[activeTab] ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        padding: "48px 0",
                        color: "var(--text-muted)",
                        fontSize: 13,
                      }}
                    >
                      <LoaderDots />
                      <span>
                        {params.language === "fr"
                          ? "Génération…"
                          : "Generating…"}
                      </span>
                    </div>
                  ) : variantMcqs[activeTab].length === 0 ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--text-muted)",
                        padding: "24px 0",
                      }}
                    >
                      {params.language === "fr"
                        ? "Aucune question pour l'instant."
                        : "No questions yet."}
                    </p>
                  ) : (
                    variantMcqs[activeTab].map((item, i) => (
                      <MCQCard
                        key={item.id}
                        item={item}
                        index={i}
                        revealed={revealedIds.has(item.id)}
                        onReveal={(id) =>
                          setRevealedIds((s) =>
                            new Set(Array.from(s).concat(id))
                          )
                        }
                      />
                    ))
                  ))}
              </div>

              {phase === "done" && (
                <ChatBar
                  key={activeTab}
                  history={chatHistories[activeTab]}
                  loading={chatLoadingTab[activeTab]}
                  onSend={handleChatSend}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
