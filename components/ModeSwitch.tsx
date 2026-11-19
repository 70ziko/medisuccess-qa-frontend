"use client";

const MODES = [
  [true, "AI redraw"],
  [false, "Numbers only"],
] as const;

/** AI redraw or numbers placed by code. `redraw: null` shows a mix: neither option selected. */
export function ModeSwitch({
  redraw,
  onChange,
  disabled,
  compact,
  title,
}: {
  redraw: boolean | null;
  onChange: (redraw: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  title?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Output"
      title={title}
      style={{
        display: "flex",
        gap: 2,
        background: "var(--bg)",
        borderRadius: compact ? 7 : 8,
        padding: compact ? 2 : 3,
        opacity: disabled ? 0.55 : 1,
        flexShrink: 0,
      }}
    >
      {MODES.map(([value, label]) => {
        const selected = redraw === value;
        return (
          <button
            key={label}
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(value)}
            style={{
              flex: 1,
              padding: compact ? "2px 8px" : "6px 10px",
              borderRadius: compact ? 5 : 6,
              border: "none",
              fontSize: compact ? 11.5 : 12.5,
              fontWeight: 500,
              whiteSpace: "nowrap",
              background: selected ? "var(--surface)" : "transparent",
              color: selected ? "var(--text)" : "var(--text-muted)",
              boxShadow: selected ? "0 1px 3px rgba(0,0,0,.10)" : "none",
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "var(--font)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
