import type { DiagramLegendEntry } from "@/types";

// The platform stores a fiche's legend as `anatomie_fiches.legendes` (string[]),
// where entry i is callout number i + 1 — the same shape as the `legendes` field
// of AnatomieFicheCreate / AnatomieFicheUpdate in Medisuccess-back.
export function legendes(legend: DiagramLegendEntry[]): string[] {
  return [...legend].sort((a, b) => a.numero - b.numero).map((e) => e.label.trim());
}

/** True when the numbers are not exactly 1..n, so array positions would misalign. */
export function hasNumberingGap(legend: DiagramLegendEntry[]): boolean {
  return [...legend]
    .sort((a, b) => a.numero - b.numero)
    .some((e, i) => e.numero !== i + 1);
}

/** Ready to paste as the body (or the `legendes` field) of a fiche create/update. */
export function ficheJson(legend: DiagramLegendEntry[]): string {
  return JSON.stringify({ legendes: legendes(legend) }, null, 2);
}

export function batchJson(items: { fichier: string; legend: DiagramLegendEntry[] }[]): string {
  return JSON.stringify(
    items.map((it) => ({ fichier: it.fichier, legendes: legendes(it.legend) })),
    null,
    2
  );
}

/** File name without extension, safe on every OS. */
export function stemOf(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-").trim() || "schema";
}

export function outputName(stem: string): string {
  return `${stem}-numerote.png`;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function dataUrlToFile(dataUrl: string, name: string): File {
  const mime = dataUrl.slice(5, dataUrl.indexOf(";")) || "application/octet-stream";
  return new File([dataUrlToBytes(dataUrl)], name, { type: mime });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDataUrl(dataUrl: string, name: string) {
  downloadBlob(new Blob([dataUrlToBytes(dataUrl)], { type: "image/png" }), name);
}

// ── Minimal ZIP writer (stored, no compression: PNGs are already compressed) ──

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Blob {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names (accents)
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, file.data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, date, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, file.data.length, true);
    entry.setUint32(24, file.data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + file.data.length;
  }

  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], {
    type: "application/zip",
  });
}
