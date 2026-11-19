"use client";

import officialLogo from "@/assets/Official Logo round.png";

export type StaffMode = "qa" | "diagrams";

const MODES: { id: StaffMode; label: string; subtitle: string }[] = [
  { id: "qa", label: "Q&A", subtitle: "Q&A Generator" },
  { id: "diagrams", label: "Diagrams", subtitle: "Numbered diagrams" },
];

/** Logo block at the top of the left panel, with the switch between the staff tools. */
export function AppHeader({
  mode = "qa",
  onModeChange,
}: {
  mode?: StaffMode;
  onModeChange?: (m: StaffMode) => void;
}) {
  const subtitle = MODES.find((m) => m.id === mode)?.subtitle;
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        style={{
          padding: "18px 20px 14px",
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
          <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: "-0.01em" }}>
            MediSuccess
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.02em" }}>
            {subtitle}
          </div>
        </div>
      </div>

      {onModeChange && (
        <div style={{ padding: "0 20px 14px" }}>
          <div
            role="tablist"
            style={{
              display: "flex",
              gap: 2,
              background: "var(--bg)",
              borderRadius: 8,
              padding: 3,
            }}
          >
            {MODES.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => onModeChange(id)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  background: mode === id ? "var(--surface)" : "transparent",
                  color: mode === id ? "var(--accent)" : "var(--text-muted)",
                  boxShadow: mode === id ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                  cursor: "pointer",
                  fontFamily: "var(--font)",
                  transition: "all .15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
