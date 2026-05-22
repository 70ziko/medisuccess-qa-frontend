"use client";

import type { GenerateParams } from "@/types";

const DIFFICULTY_COLORS: Record<
  GenerateParams["difficulty"],
  { light: string; border: string; text: string }
> = {
  easy: { light: "var(--green-light)", border: "var(--green-border)", text: "var(--green)" },
  intermediate: {
    light: "var(--amber-light)",
    border: "var(--amber-border)",
    text: "var(--amber)",
  },
  hard: { light: "var(--red-light)", border: "var(--red-border)", text: "var(--red)" },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "#FAFAF8",
  fontSize: 13,
  fontFamily: "var(--font)",
  color: "var(--text)",
  outline: "none",
  appearance: "none" as const,
  transition: "border .15s",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-muted)",
          display: "block",
          marginBottom: 5,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

interface Props {
  params: GenerateParams;
  onChange: (p: GenerateParams) => void;
}

function CountField({
  label,
  value,
  adaptive,
  enabled,
  onValueChange,
  onAdaptiveChange,
  onEnabledChange,
}: {
  label: string;
  value: number;
  adaptive: boolean;
  enabled: boolean;
  onValueChange: (n: number) => void;
  onAdaptiveChange: (b: boolean) => void;
  onEnabledChange: (b: boolean) => void;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: enabled ? "var(--text)" : "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 5,
          letterSpacing: "0.02em",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          title="Generate this on the first pass"
          style={{ accentColor: "var(--accent)", cursor: "pointer", margin: 0 }}
        />
        {label}
      </label>
      <div style={{ display: "flex", gap: 6, opacity: enabled ? 1 : 0.4 }}>
        <input
          type="number"
          min={1}
          max={50}
          value={adaptive ? "" : value}
          disabled={adaptive || !enabled}
          placeholder={adaptive ? "Auto" : undefined}
          onChange={(e) => onValueChange(Number(e.target.value))}
          style={{
            ...inputStyle,
            flex: 1,
            opacity: adaptive ? 0.55 : 1,
          }}
        />
        <button
          type="button"
          disabled={!enabled}
          onClick={() => onAdaptiveChange(!adaptive)}
          data-tooltip="Let the generator pick a count based on document length"
          style={{
            padding: "0 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            border: adaptive
              ? "1.5px solid var(--accent)"
              : "1.5px solid var(--border)",
            background: adaptive ? "var(--accent-light)" : "#F7F6F3",
            color: adaptive ? "var(--accent)" : "var(--text-muted)",
            cursor: enabled ? "pointer" : "not-allowed",
            fontFamily: "var(--font)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Auto
        </button>
      </div>
    </div>
  );
}

export function ParamsForm({ params, onChange }: Props) {
  const set = <K extends keyof GenerateParams>(k: K, v: GenerateParams[K]) =>
    onChange({ ...params, [k]: v });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          display: "block",
          marginBottom: -6,
        }}
      >
        Parameters
      </label>

      <Field label="Topic / Focus">
        <input
          value={params.topic}
          onChange={(e) => set("topic", e.target.value)}
          placeholder="e.g. Pharmacologie digestive"
          style={inputStyle}
        />
      </Field>

      <Field label="Language">
        <select
          value={params.language}
          onChange={(e) => set("language", e.target.value as "fr" | "en")}
          style={inputStyle}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </Field>

      <Field label="Difficulty">
        <div style={{ display: "flex", gap: 6 }}>
          {(["easy", "intermediate", "hard"] as const).map((d) => {
            const c = DIFFICULTY_COLORS[d];
            const selected = params.difficulty === d;
            return (
              <button
                key={d}
                onClick={() => set("difficulty", d)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 500,
                  border: selected
                    ? `1.5px solid ${c.border}`
                    : "1.5px solid var(--border)",
                  background: selected ? c.light : "#F7F6F3",
                  color: selected ? c.text : "var(--text-muted)",
                  cursor: "pointer",
                  fontFamily: "var(--font)",
                  transition: "all .15s",
                  textTransform: "capitalize",
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <CountField
          label="MCQ"
          value={params.mcq_count}
          adaptive={params.mcq_adaptive}
          enabled={params.mcq_enabled}
          onValueChange={(n) => set("mcq_count", n)}
          onAdaptiveChange={(b) => set("mcq_adaptive", b)}
          onEnabledChange={(b) => set("mcq_enabled", b)}
        />
        <CountField
          label="Flashcards"
          value={params.flashcard_count}
          adaptive={params.flashcard_adaptive}
          enabled={params.flashcard_enabled}
          onValueChange={(n) => set("flashcard_count", n)}
          onAdaptiveChange={(b) => set("flashcard_adaptive", b)}
          onEnabledChange={(b) => set("flashcard_enabled", b)}
        />
      </div>

      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          display: "block",
          marginBottom: -6,
        }}
      >
        Variant counts
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <CountField
          label="MCQ – HQ"
          value={params.hq_count}
          adaptive={params.hq_adaptive}
          enabled={params.hq_enabled}
          onValueChange={(n) => set("hq_count", n)}
          onAdaptiveChange={(b) => set("hq_adaptive", b)}
          onEnabledChange={(b) => set("hq_enabled", b)}
        />
        <CountField
          label="Trial"
          value={params.trial_count}
          adaptive={params.trial_adaptive}
          enabled={params.trial_enabled}
          onValueChange={(n) => set("trial_count", n)}
          onAdaptiveChange={(b) => set("trial_adaptive", b)}
          onEnabledChange={(b) => set("trial_enabled", b)}
        />
        <CountField
          label="QCU"
          value={params.qcu_count}
          adaptive={params.qcu_adaptive}
          enabled={params.qcu_enabled}
          onValueChange={(n) => set("qcu_count", n)}
          onAdaptiveChange={(b) => set("qcu_adaptive", b)}
          onEnabledChange={(b) => set("qcu_enabled", b)}
        />
      </div>
    </div>
  );
}
