export type ParsedRow = string[];

/** Minimal RFC4180-ish CSV parser: handles quotes, escaped quotes, CRLF, and , or ; or tab delimiters. */
export function parseCsv(text: string): ParsedRow[] {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean);
  const rows: ParsedRow[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // ignore
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);

  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c.length > 0));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) || []).length,
    ";": (firstLine.match(/;/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

const FRONT_KEYS = ["front", "word", "term", "单词", "正面", "问题", "question"];
const BACK_KEYS = ["back", "meaning", "definition", "释义", "翻译", "背面", "答案", "answer"];
const HINT_KEYS = ["hint", "example", "note", "例句", "备注", "提示"];

export type CsvCard = { front: string; back: string; hint?: string };

export function rowsToCards(rows: ParsedRow[]): CsvCard[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const frontIdx = header.findIndex((h) => FRONT_KEYS.includes(h));
  const backIdx = header.findIndex((h) => BACK_KEYS.includes(h));
  const hasHeader = frontIdx !== -1 && backIdx !== -1;
  const hintIdx = hasHeader ? header.findIndex((h) => HINT_KEYS.includes(h)) : 2;

  const body = hasHeader ? rows.slice(1) : rows;
  const fi = hasHeader ? frontIdx : 0;
  const bi = hasHeader ? backIdx : 1;

  return body
    .map((r) => ({
      front: r[fi] ?? "",
      back: r[bi] ?? "",
      hint: hintIdx >= 0 ? r[hintIdx] || undefined : undefined,
    }))
    .filter((c) => c.front.length > 0 && c.back.length > 0);
}
