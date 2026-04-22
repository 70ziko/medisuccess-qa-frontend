"use client";

interface Props {
  step: number;
  totalSteps: number;
  message: string;
}

export function GenerationProgress({ step, totalSteps, message }: Props) {
  const pct = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 20,
        padding: 32,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "2.5px solid var(--accent-border)",
          borderTopColor: "var(--accent)",
          animation: "spin .8s linear infinite",
        }}
      />
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--text-muted)",
            fontWeight: 500,
            marginBottom: 14,
          }}
        >
          {message}
        </p>
        <div
          style={{
            width: 220,
            height: 3,
            background: "var(--border)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "var(--accent)",
              borderRadius: 3,
              transition: "width .4s ease",
            }}
          />
        </div>
        <p
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 6,
            fontFamily: "var(--mono)",
          }}
        >
          {step}/{totalSteps}
        </p>
      </div>
    </div>
  );
}
