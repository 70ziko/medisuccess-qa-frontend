"use client";

import { useCallback, useState } from "react";
import officialLogo from "@/assets/Official Logo round.png";
import type {
  ChatMessage,
  Flashcard,
  GenerateParams,
  GenerationPhase,
  MCQ,
  MCQVariant,
  Tab,
  TokenUsage,
} from "@/types";
import { TAB_ADAPTIVE_KEY, TAB_COUNT_KEY, TAB_ENABLED_KEY } from "@/types";
import {
  generateSection,
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
import { TokenUsagePanel } from "./TokenUsagePanel";
import { Icon, LoaderDots } from "./Icons";

const DEFAULT_PARAMS: GenerateParams = {
  topic: "",
  language: "fr",
  difficulty: "intermediate",
  mcq_count: 10,
  flashcard_count: 10,
  mcq_adaptive: false,
  flashcard_adaptive: true,
  hq_count: 10,
  trial_count: 6,
  qcu_count: 10,
  hq_adaptive: false,
  trial_adaptive: false,
  qcu_adaptive: false,
  parallelize_flashcards: false,
  // First-class sections default on; variants are opt-in per generation.
  mcq_enabled: true,
  flashcard_enabled: true,
  hq_enabled: false,
  trial_enabled: false,
  qcu_enabled: false,
};

const ALL_TABS: Tab[] = ["mcq", "flashcards", "hq", "trial", "qcu"];

const TAB_LABEL: Record<Tab, string> = {
  mcq: "MCQ",
  flashcards: "Flashcards",
  hq: "MCQ – HQ",
  trial: "Trial",
  qcu: "QCU",
};

const emptyHistories = (): Record<Tab, ChatMessage[]> =>
  Object.fromEntries(ALL_TABS.map((t) => [t, [] as ChatMessage[]])) as Record<
    Tab,
    ChatMessage[]
  >;

const emptyBools = (): Record<Tab, boolean> =>
  Object.fromEntries(ALL_TABS.map((t) => [t, false])) as Record<Tab, boolean>;

export function QAGeneratorApp() {
  const [files, setFiles] = useState<File[]>([]);
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
    emptyBools
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [showTokens, setShowTokens] = useState(false);
  const [variantMcqs, setVariantMcqs] = useState<Record<MCQVariant, MCQ[]>>({
    hq: [],
    trial: [],
    qcu: [],
  });
  // Which tabs have produced their content (even if it came back empty), and
  // which are mid-generation (first pass or on-demand).
  const [generatedTabs, setGeneratedTabs] = useState<Set<Tab>>(new Set());
  const [loadingTabs, setLoadingTabs] = useState<Record<Tab, boolean>>(
    emptyBools
  );

  const isVariantTab = (t: Tab): t is MCQVariant =>
    t === "hq" || t === "trial" || t === "qcu";

  // Reference set for the trial second pass: the already-generated HQ list, or
  // MCQ when HQ has none, or empty (standalone) when neither exists.
  const trialReference = (): MCQ[] =>
    variantMcqs.hq.length > 0 ? variantMcqs.hq : mcqs;

  const markGenerated = (t: Tab) =>
    setGeneratedTabs((s) => {
      const next = new Set(s);
      next.add(t);
      return next;
    });

  // On-demand generation of a single section (the per-tab "Generate" button,
  // and the toolbar regenerate action).
  const runSection = useCallback(
    (t: Tab) => {
      if (!jobId) return;
      setLoadingTabs((s) => ({ ...s, [t]: true }));
      const reference = t === "trial" ? trialReference() : [];
      generateSection(
        jobId,
        t,
        params[TAB_COUNT_KEY[t]],
        params[TAB_ADAPTIVE_KEY[t]],
        reference
      )
        .then((res) => {
          if (t === "flashcards") {
            if (res.flashcards) setFlashcards(res.flashcards);
          } else if (t === "mcq") {
            if (res.mcqs) setMcqs(res.mcqs);
          } else if (res.mcqs) {
            setVariantMcqs((s) => ({ ...s, [t]: res.mcqs! }));
          }
          markGenerated(t);
        })
        .catch((err: Error) => setErrorMsg(err.message))
        .finally(() => setLoadingTabs((s) => ({ ...s, [t]: false })));
    },
    [jobId, params, variantMcqs, mcqs]
  );

  const isReady = files.length > 0 || params.topic.trim().length > 0;

  const handleGenerate = useCallback(() => {
    if (!isReady) return;
    // Snapshot the sections selected for this run; the SSE handlers below use
    // it to decide which tabs are "generated" once the stream ends.
    const firstPass = new Set<Tab>(
      ALL_TABS.filter((t) => params[TAB_ENABLED_KEY[t]])
    );

    setPhase("loading");
    setRevealedIds(new Set());
    setChatHistories(emptyHistories());
    setChatLoadingTab(emptyBools());
    setProgressStep(0);
    setProgressMsg("Initialisation…");
    setTokenUsage(null);
    setShowTokens(false);

    setMcqs([]);
    setFlashcards([]);
    setVariantMcqs({ hq: [], trial: [], qcu: [] });
    setGeneratedTabs(new Set());
    setLoadingTabs(
      Object.fromEntries(
        ALL_TABS.map((t) => [t, firstPass.has(t)])
      ) as Record<Tab, boolean>
    );

    // Land on the first selected tab so the user isn't staring at an empty one.
    const firstSelected = ALL_TABS.find((t) => firstPass.has(t));
    if (firstSelected) setActiveTab(firstSelected);

    const stop = startGenerationStream(
      files,
      params,
      (event) => {
        if (event.type === "progress") {
          setProgressStep(event.step ?? 0);
          setProgressTotal(event.total_steps ?? 5);
          setProgressMsg(event.message ?? "");
        } else if (event.type === "flashcards_partial") {
          setFlashcards((prev) => [...prev, ...event.data]);
          setPhase((p) => (p === "loading" ? "streaming" : p));
          markGenerated("flashcards");
          setLoadingTabs((s) => ({ ...s, flashcards: false }));
        } else if (event.type === "mcq_result") {
          setMcqs(event.data);
          markGenerated("mcq");
          setLoadingTabs((s) => ({ ...s, mcq: false }));
          setPhase((p) => (p === "loading" ? "streaming" : p));
        } else if (event.type === "variant_result") {
          const v = event.variant;
          setVariantMcqs((s) => ({ ...s, [v]: event.data }));
          markGenerated(v);
          setLoadingTabs((s) => ({ ...s, [v]: false }));
          setPhase((p) => (p === "loading" ? "streaming" : p));
        } else if (event.type === "tokens_update") {
          setTokenUsage(event.data);
        } else if (event.type === "result") {
          setMcqs(event.data.mcqs);
          setFlashcards(event.data.flashcards);
          setJobId(event.data.job_id);
          setGeneratedTabs((s) => {
            const next = new Set(s);
            firstPass.forEach((t) => next.add(t));
            return next;
          });
          setLoadingTabs((s) => {
            const next = { ...s };
            firstPass.forEach((t) => {
              next[t] = false;
            });
            return next;
          });
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
  }, [files, params, isReady]);

  const handleChatSend = async (message: string, images: string[] = []) => {
    // Snapshot the tab so the reply lands on the thread it was sent from,
    // even if the user switches tabs mid-request.
    const tab = activeTab;
    const variant = isVariantTab(tab) ? tab : undefined;
    const isFlashcards = tab === "flashcards";
    // Images only apply to MCQ-style tabs.
    const attachedImages = isFlashcards ? [] : images;
    // Images with no typed instruction still need a directive for the LLM.
    const outboundMessage =
      message ||
      (attachedImages.length > 0
        ? params.language === "fr"
          ? "Crée une question pour chaque image."
          : "Create a question for each image."
        : message);
    const tabMcqs = variant ? variantMcqs[variant] : mcqs;
    const appendToTab = (msg: ChatMessage) =>
      setChatHistories((h) => ({ ...h, [tab]: [...h[tab], msg] }));

    appendToTab({ role: "user", text: message, images: attachedImages });
    setChatLoadingTab((s) => ({ ...s, [tab]: true }));
    try {
      const reply = await sendChatMessage({
        jobId,
        mode: isFlashcards ? "flashcards" : "mcq",
        message: outboundMessage,
        history: chatHistories[tab],
        currentMcqs: tabMcqs,
        currentFlashcards: flashcards,
        variant,
        images: attachedImages,
        referenceMcqs: variant === "trial" ? trialReference() : [],
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
    setFiles([]);
    setMcqs([]);
    setFlashcards([]);
    setChatHistories(emptyHistories());
    setChatLoadingTab(emptyBools());
    setRevealedIds(new Set());
    setVariantMcqs({ hq: [], trial: [], qcu: [] });
    setGeneratedTabs(new Set());
    setLoadingTabs(emptyBools());
    setActiveTab("mcq");
    setTokenUsage(null);
    setShowTokens(false);
  };

  // MCQ list backing the active tab (variant tabs have their own list).
  const activeMcqs = isVariantTab(activeTab) ? variantMcqs[activeTab] : mcqs;

  const onReveal = (id: string) =>
    setRevealedIds((s) => new Set(Array.from(s).concat(id)));

  // Centered prompt for a tab that wasn't part of the first pass.
  const GeneratePrompt = ({ tab }: { tab: Tab }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "56px 0",
        color: "var(--text-muted)",
      }}
    >
      <p style={{ fontSize: 13.5 }}>
        {params.language === "fr"
          ? `« ${TAB_LABEL[tab]} » n'a pas encore été généré.`
          : `"${TAB_LABEL[tab]}" hasn't been generated yet.`}
      </p>
      <button
        onClick={() => runSection(tab)}
        disabled={!jobId}
        style={{
          padding: "9px 18px",
          borderRadius: "var(--radius)",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          fontFamily: "var(--font)",
          fontSize: 13,
          fontWeight: 600,
          cursor: jobId ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <Icon name="sparkle" size={13} />
        {params.language === "fr" ? "Générer" : "Generate"}
      </button>
    </div>
  );

  const LoadingPane = () => (
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
        {params.language === "fr" ? "Génération…" : "Generating…"}
      </span>
    </div>
  );

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
          <img
            src={officialLogo.src}
            alt="MediSuccess logo"
            width={32}
            height={32}
            style={{
              width: 32,
              height: 32,
              display: "block",
              borderRadius: 999,
              objectFit: "cover",
            }}
          />
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
          <PDFDropzone files={files} onChange={setFiles} />
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
              onTabChange={setActiveTab}
              loadingTabs={loadingTabs}
              activeMcqs={activeMcqs}
              flashcards={flashcards}
              revealedCount={revealedIds.size}
              topic={params.topic}
              onClear={handleClear}
              onRegenerate={
                generatedTabs.has(activeTab)
                  ? () => runSection(activeTab)
                  : undefined
              }
              regenerating={loadingTabs[activeTab]}
              tokenUsage={tokenUsage}
              onToggleTokens={() => setShowTokens((s) => !s)}
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
                  (loadingTabs.mcq ? (
                    <LoadingPane />
                  ) : !generatedTabs.has("mcq") ? (
                    <GeneratePrompt tab="mcq" />
                  ) : (
                    mcqs.map((item, i) => (
                      <MCQCard
                        key={item.id}
                        item={item}
                        index={i}
                        revealed={revealedIds.has(item.id)}
                        onReveal={onReveal}
                      />
                    ))
                  ))}

                {activeTab === "flashcards" &&
                  (loadingTabs.flashcards && flashcards.length === 0 ? (
                    <LoadingPane />
                  ) : !generatedTabs.has("flashcards") &&
                    flashcards.length === 0 ? (
                    <GeneratePrompt tab="flashcards" />
                  ) : (
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
                  ))}

                {isVariantTab(activeTab) &&
                  (loadingTabs[activeTab] ? (
                    <LoadingPane />
                  ) : !generatedTabs.has(activeTab) ? (
                    <GeneratePrompt tab={activeTab} />
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
                        onReveal={onReveal}
                      />
                    ))
                  ))}
              </div>

              {phase === "done" && generatedTabs.has(activeTab) && (
                <ChatBar
                  key={activeTab}
                  history={chatHistories[activeTab]}
                  loading={chatLoadingTab[activeTab]}
                  onSend={handleChatSend}
                  imageEnabled={activeTab !== "flashcards"}
                />
              )}
            </div>
          </>
        )}
      </div>

      {showTokens && tokenUsage && (
        <TokenUsagePanel
          usage={tokenUsage}
          activeTab={activeTab}
          loadingTabs={loadingTabs}
          generatedTabs={generatedTabs}
          onClose={() => setShowTokens(false)}
        />
      )}
    </div>
  );
}
