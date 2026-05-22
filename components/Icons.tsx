"use client";

interface IconProps {
  size?: number;
  style?: React.CSSProperties;
}

const paths: Record<string, React.ReactNode> = {
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  sparkle: (
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  ),
  refresh: (
    <>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  flip: (
    <>
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </>
  ),
  logo: (
    <g fill="currentColor">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" opacity="0.4" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" opacity="0.4" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </g>
  ),
};

export function Icon({
  name,
  size = 16,
  style,
}: IconProps & { name: string }) {
  const strokeIcons = ["upload", "file", "send", "copy", "check", "x", "sparkle", "refresh", "download", "flip"];
  const isStroke = strokeIcons.includes(name);
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", ...style }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={isStroke ? "none" : "currentColor"}
        stroke={isStroke ? "currentColor" : "none"}
        strokeWidth={isStroke ? "1.8" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[name]}
      </svg>
    </span>
  );
}

export function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-tooltip={title}
      style={{
        width: 30,
        height: 30,
        borderRadius: 7,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        transition: "all .15s",
        fontFamily: "var(--font)",
      }}
    >
      {children}
    </button>
  );
}

export function LoaderDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

export function Pill({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "accent" | "green" | "muted";
}) {
  const colors = {
    accent: {
      bg: "var(--accent-light)",
      border: "var(--accent-border)",
      text: "var(--accent)",
    },
    green: {
      bg: "var(--green-light)",
      border: "var(--green)",
      text: "var(--green)",
    },
    muted: {
      bg: "#F7F6F3",
      border: "var(--border)",
      text: "var(--text-muted)",
    },
  };
  const c = colors[color];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 5,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontFamily: "var(--mono)",
      }}
    >
      {children}
    </span>
  );
}
