import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { parseCsv, rowsToCards } from "../../csv";

export default defineTool({
  name: "parse_flashcards_csv",
  title: "Parse flashcards CSV",
  description: "Parse CSV text supplied by the caller into word, meaning and optional example cards; does not read or save browser decks.",
  inputSchema: { csv: z.string().min(1).max(100000).describe("CSV text to parse, up to 100,000 characters.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ csv }) => {
    const cards = rowsToCards(parseCsv(csv));
    const preview = cards.slice(0, 100).map(({ front, back, hint }) => ({ front, back, ...(hint ? { hint } : {}) }));
    return {
      content: [{ type: "text", text: JSON.stringify({ total: cards.length, cards: preview, truncated: cards.length > preview.length }) }],
      structuredContent: { total: cards.length, cards: preview, truncated: cards.length > preview.length },
    };
  },
});