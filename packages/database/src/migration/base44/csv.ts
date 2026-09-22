export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

// Strict CSV state machine: quoted delimiters/newlines and doubled quotes are data.
// Errors contain codes only; parser input must never appear in an exception/report.
export function parseCsv(input: string): CsvTable {
  const text = input.replace(/^\uFEFF/, "");
  if (text === "") return { headers: [], rows: [] };
  const records: string[][] = [];
  let record: string[] = [];
  let value = "";
  let state: "start" | "plain" | "quoted" | "closed" = "start";
  let pending = false;
  const cell = (): void => { record.push(value); value = ""; state = "start"; };
  const row = (): void => { cell(); records.push(record); record = []; pending = false; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    pending = true;
    if (state === "quoted") {
      if (char === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; }
        else state = "closed";
      } else value += char;
      continue;
    }
    if (char === ",") { cell(); continue; }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row();
      continue;
    }
    if (state === "closed") throw new Error("CSV_AFTER_QUOTE");
    if (char === '"') {
      if (state !== "start") throw new Error("CSV_UNEXPECTED_QUOTE");
      state = "quoted";
    } else { value += char; state = "plain"; }
  }
  if (state === "quoted") throw new Error("CSV_UNCLOSED_QUOTE");
  if (pending) row();
  const headers = records.shift() ?? [];
  if (headers.some(header => !header) || new Set(headers).size !== headers.length)
    throw new Error("CSV_INVALID_HEADER");
  const rows = records.map(cells => {
    if (cells.length !== headers.length) throw new Error("CSV_ROW_WIDTH");
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
  return { headers, rows };
}
