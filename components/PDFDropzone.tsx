"use client";

import { useRef } from "react";
import { Icon } from "./Icons";

interface Props {
  files: File[];
  onChange: (f: File[]) => void;
}

export function PDFDropzone({ files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Merge in new PDFs and images, skipping duplicates (same name + size).
  // Images are passed to the exercise agent as question figures (decay schemes,
  // graphs, tables, …); PDFs feed the full pipeline.
  const isAccepted = (f: File) =>
    f.type === "application/pdf" ||
    f.type.startsWith("image/") ||
    /\.(pdf|png|jpe?g|webp|gif)$/i.test(f.name);

  const addFiles = (incoming: File[]) => {
    const accepted = incoming.filter(isAccepted);
    const merged = [...files];
    for (const f of accepted) {
      if (!merged.some((e) => e.name === f.name && e.size === f.size)) {
        merged.push(f);
      }
    }
    onChange(merged);
  };

  const isImage = (f: File) =>
    f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeAt = (i: number) =>
    onChange(files.filter((_, idx) => idx !== i));

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
        Sources
      </label>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{
          border:
            files.length > 0
              ? "1.5px solid var(--accent-border)"
              : "1.5px dashed var(--border)",
          borderRadius: "var(--radius)",
          padding: 16,
          textAlign: "center",
          cursor: "pointer",
          background: files.length > 0 ? "var(--accent-light)" : "#FAFAF8",
          transition: "all .2s ease",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp,image/gif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
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
          {files.length > 0 ? "Add more files" : "Drop PDFs or images here"}
          <br />
          <span style={{ fontSize: 11 }}>or click to browse</span>
        </div>
      </div>

      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {files.map((file, i) => (
            <div
              key={`${file.name}-${file.size}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: "var(--radius)",
                background: "var(--accent-light)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <span style={{ color: "var(--accent)" }}>
                <Icon name={isImage(file) ? "image" : "file"} size={15} />
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
                }}
              >
                {file.name}
              </span>
              <button
                onClick={() => removeAt(i)}
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
          ))}
        </div>
      )}
    </div>
  );
}
