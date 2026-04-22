"use client";

import type { GenerateParams } from "@/types";

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
          {(["easy", "intermediate", "hard"] as const).map((d) => (
            <button
              key={d}
              onClick={() => set("difficulty", d)}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 500,
                border:
                  params.difficulty === d
                    ? "1.5px solid var(--accent)"
                    : "1.5px solid var(--border)",
                background:
                  params.difficulty === d
                    ? "var(--accent-light)"
                    : "#F7F6F3",
                color:
                  params.difficulty === d
                    ? "var(--accent)"
                    : "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "var(--font)",
                transition: "all .15s",
                textTransform: "capitalize",
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="MCQ count">
          <input
            type="number"
            min={1}
            max={50}
            value={params.mcq_count}
            onChange={(e) => set("mcq_count", Number(e.target.value))}
            style={inputStyle}
          />
        </Field>
        <Field label="Flashcards">
          <input
            type="number"
            min={1}
            max={50}
            value={params.flashcard_count}
            onChange={(e) => set("flashcard_count", Number(e.target.value))}
            style={inputStyle}
          />
        </Field>
      </div>
    </div>
  );
}
