"use client";

import { useRef } from "react";
import { Icon } from "./Icons";

interface Props {
  file: File | null;
  onChange: (f: File | null) => void;
}

export function PDFDropzone({ file, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") onChange(f);
  };

  return (
    <div>
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          display: "block",
          marginBottom: 8,
        }}
      >
        Source
      </label>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !file && inputRef.current?.click()}
        style={{
          border: file
            ? "1.5px solid var(--accent-border)"
            : "1.5px dashed var(--border)",
          borderRadius: "var(--radius)",
          padding: 16,
          textAlign: "center",
          cursor: file ? "default" : "pointer",
          background: file ? "var(--accent-light)" : "#FAFAF8",
          transition: "all .2s ease",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: "none" }}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
            }}
          >
            <span style={{ color: "var(--accent)" }}>
              <Icon name="file" size={15} />
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--accent)",
                flex: 1,
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 160,
              }}
            >
              {file.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: 2,
              }}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ) : (
          <>
            <Icon
              name="upload"
              size={18}
              style={{ color: "var(--text-muted)", marginBottom: 6 }}
            />
            <div
              style={{
                fontSize: 12.5,
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              Drop a PDF here
              <br />
              <span style={{ fontSize: 11 }}>or click to browse</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
