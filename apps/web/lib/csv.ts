export type CsvParseResult = {
  headers: string[];
  rows: Record<string, string>[];
  errors: { row: number; message: string }[];
};

type SplitResult = { fields: string[]; error?: string };

function splitLine(line: string): SplitResult {
  const fields: string[] = [];
  let buffer = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          buffer += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        buffer += char;
      }
    } else if (char === '"') {
      if (buffer.length > 0) return { fields, error: "Unexpected quote in unquoted field" };
      inQuotes = true;
    } else if (char === ",") {
      fields.push(buffer);
      buffer = "";
    } else {
      buffer += char;
    }
  }
  if (inQuotes) return { fields, error: "Unclosed quoted field" };
  fields.push(buffer);
  return { fields };
}

export function parseCsv(input: string): CsvParseResult {
  const lines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) return { headers: [], rows: [], errors: [] };
  const headerResult = splitLine(lines[0]);
  if (headerResult.error) return { headers: [], rows: [], errors: [{ row: 0, message: headerResult.error }] };
  const headers = headerResult.fields.map((cell) => cell.trim());
  const rows: Record<string, string>[] = [];
  const errors: { row: number; message: string }[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const result = splitLine(lines[i]);
    if (result.error) {
      errors.push({ row: i, message: result.error });
      continue;
    }
    const cells = result.fields;
    if (cells.length !== headers.length) {
      errors.push({ row: i, message: `Expected ${headers.length} columns, got ${cells.length}` });
      continue;
    }
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = (cells[idx] ?? "").trim();
    });
    rows.push(record);
  }
  return { headers, rows, errors };
}
