"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types";
import { Icon, LoaderDots } from "./Icons";

interface Props {
  history: ChatMessage[];
  loading: boolean;
  onSend: (msg: string, images: string[]) => void;
  /** Whether attaching images is allowed (MCQ-style tabs only). */
  imageEnabled?: boolean;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ChatBar({ history, loading, onSend, imageEnabled }: Props) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const canSend = (input.trim().length > 0 || images.length > 0) && !loading;

  const resetFileInput = () => {
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    onSend(input.trim(), images);
    setInput("");
    setImages([]);
    resetFileInput();
  };

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      const urls = await Promise.all(files.map(readAsDataUrl));
      setImages((prev) => [...prev, ...urls]);
    } catch {
      /* ignore unreadable files */
    }
    // Allow re-picking the same file(s) again later.
    resetFileInput();
  };

  const removeImage = (idx: number) =>
    setImages((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "12px 18px",
        flexShrink: 0,
      }}
    >
      {history.length > 0 && (
        <div
          style={{
            maxHeight: 140,
            overflowY: "auto",
            marginBottom: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {history.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "72%",
                  padding: "7px 11px",
                  borderRadius: 9,
                  fontSize: 13,
                  lineHeight: 1.5,
                  background:
                    msg.role === "user" ? "var(--accent)" : "var(--bg)",
                  color: msg.role === "user" ? "#fff" : "var(--text)",
                  border:
                    msg.role === "assistant"
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                {msg.images && msg.images.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      marginBottom: msg.text ? 6 : 0,
                    }}
                  >
                    {msg.images.map((src, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={j}
                        src={src}
                        alt="attachment"
                        style={{
                          maxWidth: 90,
                          maxHeight: 90,
                          borderRadius: 6,
                        }}
                      />
                    ))}
                  </div>
                )}
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex" }}>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 9,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                }}
              >
                <LoaderDots />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Pending attachment previews */}
      {images.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {images.map((src, idx) => (
            <div key={idx} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`attachment ${idx + 1}`}
                style={{
                  width: 48,
                  height: 48,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  display: "block",
                }}
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                title="Remove image"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "none",
                  background: "var(--text)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <Icon name="x" size={10} />
              </button>
            </div>
          ))}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {images.length} image{images.length > 1 ? "s" : ""} — one question
            each by default
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        {imageEnabled && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePick}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Attach image(s)"
              style={{
                padding: "9px 11px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background:
                  images.length > 0 ? "var(--accent-light)" : "var(--bg)",
                color:
                  images.length > 0 ? "var(--accent)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: "all .15s",
              }}
            >
              <Icon name="image" size={15} />
            </button>
          </>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            imageEnabled
              ? "Iterate, or attach image(s) and ask for questions with them…"
              : "Iterate on the results… e.g. Make questions harder, add 5 more"
          }
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            fontSize: 13,
            fontFamily: "var(--font)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            background: "var(--accent)",
            border: "none",
            color: "#fff",
            cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            transition: "opacity .15s",
          }}
        >
          <Icon name="send" size={14} />
        </button>
      </form>
    </div>
  );
}
