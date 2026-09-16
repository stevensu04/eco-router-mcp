/**
 * Minimal .xlsx reader for the data update scripts, so they need no
 * third-party dependency. It supports what eGRID workbooks use: a plain zip
 * container (stored or deflated entries), shared strings and inline strings.
 * It does not evaluate formulas or read styles.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

function openZip(buf: Buffer): (name: string) => Buffer | undefined {
  // The end-of-central-directory record sits in the last 64 KB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (offset === 0xffffffff) throw new Error("ZIP64 archives are not supported");

  const entries = new Map<string, { method: number; size: number; localOffset: number }>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error("Corrupt zip central directory");
    const nameLength = buf.readUInt16LE(offset + 28);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, {
      method: buf.readUInt16LE(offset + 10),
      size: buf.readUInt32LE(offset + 20),
      localOffset: buf.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + buf.readUInt16LE(offset + 30) + buf.readUInt16LE(offset + 32);
  }

  return (name) => {
    const entry = entries.get(name);
    if (!entry) return undefined;
    const local = entry.localOffset;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + entry.size);
    if (entry.method === 0) return data;
    if (entry.method === 8) return inflateRawSync(data);
    throw new Error(`Unsupported zip compression method ${entry.method} for ${name}`);
  };
}

function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()]!;
  });
}

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

function textOf(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]!)).join("");
}

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of /^[A-Z]+/.exec(ref)![0]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Lists sheet names in workbook order. */
export function sheetNames(path: string): string[] {
  const read = openZip(readFileSync(path));
  const workbook = read("xl/workbook.xml")?.toString("utf8") ?? "";
  return [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => decodeXml(attr(m[0], "name") ?? ""));
}

/** Reads one sheet as rows of cell text. Missing cells are empty strings. */
export function readSheet(path: string, sheetName: string): string[][] {
  const read = openZip(readFileSync(path));
  const workbook = read("xl/workbook.xml")?.toString("utf8");
  const rels = read("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbook || !rels) throw new Error(`${path} is not an xlsx workbook`);

  const sheetTag = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => m[0]).find((t) => decodeXml(attr(t, "name") ?? "") === sheetName);
  if (!sheetTag) throw new Error(`Sheet "${sheetName}" not found`);
  const relId = attr(sheetTag, "r:id");
  const relTag = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => attr(t, "Id") === relId);
  const target = relTag && attr(relTag, "Target");
  if (!target) throw new Error(`No worksheet file for sheet "${sheetName}"`);
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;

  const shared = [...(read("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));
  const sheet = read(sheetPath)?.toString("utf8");
  if (!sheet) throw new Error(`Missing ${sheetPath}`);

  return [...sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const cells: string[] = [];
    for (const cell of row[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cell[1]!, "r");
      if (!ref) continue;
      const body = cell[2] ?? "";
      const type = attr(cell[1]!, "t");
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s" && raw !== undefined) value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else if (raw !== undefined) value = decodeXml(raw);
      cells[columnIndex(ref)] = value;
    }
    return Array.from(cells, (v) => v ?? "");
  });
}
