"use client";

// Debug only: every text box the reading step found, drawn on the frame it was read in.
// To remove: delete this file, its tab in DiagramCard.tsx and backend app/pipeline/diagram_debug.py.

import { useState } from "react";
import type { DiagramDebug, DiagramDebugItem } from "@/types";

const ROLES: { id: DiagramDebugItem["role"]; label: string; color: string }[] = [
  { id: "label", label: "Label (numbered)", color: "#2563eb" },
  { id: "keep", label: "Kept text", color: "#16a34a" },
  { id: "remove", label: "Removed", color: "#dc2626" },
];
const FLAG_COLOR = "#d97706";
const colorOf = (role: string) => ROLES.find((r) => r.id === role)?.color ?? "#6b7280";

export function DiagramBoxes({ debug }: { debug: DiagramDebug }) {
  const [background, setBackground] = useState<"source" | "stamped">("source");
  const [shownRoles, setShownRoles] = useState<Set<string>>(new Set(ROLES.map((r) => r.id)));
  const [hover, setHover] = useState<number | null>(null);
  const { width: w, height: h } = debug;
  const stroke = Math.max(2, w / 500);
  const font = Math.max(14, w / 55);
  const visible = debug.items.map((it, i) => ({ it, i })).filter(({ it }) => shownRoles.has(it.role));
  const [sx, sy] = debug.box_scale;

  const toggleRole = (id: string) =>
    setShownRoles((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          fontSize: 12,
        }}
      >
        <select
          value={background}
          onChange={(e) => setBackground(e.target.value as "source" | "stamped")}
          style={{
            fontSize: 12,
            padding: "3px 6px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontFamily: "var(--font)",
          }}
        >
          <option value="source">On the source (upright)</option>
          <option value="stamped">On the numbered source</option>
        </select>
        {ROLES.map((r) => (
          <label
            key={r.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              cursor: "pointer",
            }}
          >
            <input type="checkbox" checked={shownRoles.has(r.id)} onChange={() => toggleRole(r.id)} />
            <span
              style={{
                width: 10,
                height: 10,
                border: `2px solid ${r.color}`,
                borderRadius: 2,
              }}
            />
            {r.label} · {debug.items.filter((it) => it.role === r.id).length}
          </label>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 10,
              border: `2px dashed ${FLAG_COLOR}`,
              borderRadius: 2,
            }}
          />
          Flagged on re-read
        </span>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{
          width: "100%",
          maxHeight: 640,
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "#fff",
        }}
        role="img"
        aria-label="Text boxes found by the reading step"
      >
        <image href={background === "source" ? debug.source_image : debug.stamped_image} width={w} height={h} />
        {visible.map(({ it, i }) => {
          const [x0, y0, x1, y1] = it.box;
          const flagged = it.flags.length > 0;
          const color = colorOf(it.role);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <title>
                {`${it.numero ? `#${it.numero} ` : ""}${it.role}: "${it.text}"` +
                  (it.legend ? ` → ${it.legend}` : "") +
                  ` · anchor ${it.anchor} · panel ${it.panel} · [${it.box.join(", ")}]` +
                  (flagged ? ` · ${it.flags.join(", ")} (2nd reading: "${it.second_reading ?? ""}")` : "")}
              </title>
              <rect
                x={x0}
                y={y0}
                width={x1 - x0}
                height={y1 - y0}
                fill={hover === i ? `${color}33` : `${color}14`}
                stroke={flagged ? FLAG_COLOR : color}
                strokeWidth={hover === i ? stroke * 2 : stroke}
                strokeDasharray={flagged ? `${stroke * 4} ${stroke * 3}` : undefined}
              />
              {it.numero !== null && (
                <text
                  x={x0}
                  y={Math.max(y0 - stroke * 2, font)}
                  fontSize={font}
                  fontWeight={700}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={font / 6}
                  paintOrder="stroke"
                >
                  {it.numero}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div
        style={{
          fontSize: 11.5,
          color: "var(--text-muted)",
          fontFamily: "var(--mono)",
        }}
      >
        frame {w}×{h} px · box rescale {sx === 1 && sy === 1 ? "none" : `×${sx.toFixed(2)} x, ×${sy.toFixed(2)} y`}
        {debug.dropped.length > 0 && ` · dropped on re-read: ${debug.dropped.join(" | ")}`}
      </div>

      <details>
        <summary
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          All {debug.items.length} boxes
        </summary>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            marginTop: 6,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)" }}>
              {["n°", "role", "text", "legend", "box", "re-read"].map((c) => (
                <th
                  key={c}
                  style={{
                    padding: "3px 6px",
                    borderBottom: "1px solid var(--border)",
                    fontWeight: 500,
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {debug.items.map((it, i) => (
              <tr
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  background: hover === i ? "var(--accent-light)" : undefined,
                }}
              >
                <td style={{ padding: "3px 6px", fontFamily: "var(--mono)" }}>{it.numero ?? ""}</td>
                <td style={{ padding: "3px 6px", color: colorOf(it.role) }}>{it.role}</td>
                <td style={{ padding: "3px 6px" }}>{it.text}</td>
                <td style={{ padding: "3px 6px" }}>{it.legend}</td>
                <td
                  style={{
                    padding: "3px 6px",
                    fontFamily: "var(--mono)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.box.join(", ")}
                </td>
                <td
                  style={{
                    padding: "3px 6px",
                    color: it.flags.length ? FLAG_COLOR : "var(--text-muted)",
                  }}
                >
                  {it.flags.length
                    ? `${it.flags.join(", ")}: "${it.second_reading ?? ""}"`
                    : it.second_reading === null
                      ? "—"
                      : "agrees"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
