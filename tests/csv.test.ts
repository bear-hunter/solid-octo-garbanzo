import { describe, expect, it } from "vitest";
import { parseCsv } from "../apps/web/lib/csv";

describe("CSV parser", () => {
  it("handles quoted commas, CRLF, and escaped quotes", () => {
    const parsed = parseCsv('NAME,DEGREE\r\n"Ada, A.","Bachelor ""Honours"""\r\n');
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toEqual({ NAME: "Ada, A.", DEGREE: 'Bachelor "Honours"' });
  });

  it("rejects malformed rows", () => {
    const parsed = parseCsv('NAME,DEGREE\n"Ada,Bachelor\nGrace,BSc');
    expect(parsed.rows).toEqual([{ NAME: "Grace", DEGREE: "BSc" }]);
    expect(parsed.errors[0]).toMatchObject({ row: 1, message: "Unclosed quoted field" });
  });
});
