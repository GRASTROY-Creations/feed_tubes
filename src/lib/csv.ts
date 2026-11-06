export type CsvRow = string[];

/** RFC 4180-style parser: quoted fields, doubled quotes, CRLF/LF; skips blank rows. */
export function parseCsv(text: string): CsvRow[] {
  const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
  const source = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const rows: CsvRow[] = [];
  let row: CsvRow = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);

    if (inQuotes) {
      if (character !== '"') {
        field += character;
      } else if (source.charAt(index + 1) === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = false;
      }
      continue;
    }

    switch (character) {
      case '"':
        inQuotes = true;
        break;
      case ",":
        row.push(field);
        field = "";
        break;
      case "\n":
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        break;
      case "\r":
        break;
      default:
        field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => value.trim() !== ""));
}

/** Values that spreadsheets would evaluate as formulas get a leading apostrophe. */
const FORMULA_PREFIX = /^[=+-]/;

function escapeCsvField(value: string): string {
  const text = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return `${rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n")}\r\n`;
}

/** `"Channel ID"`, `"channel_id"`, `"channel-id"` → `"channelid"` */
export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, "");
}

export function rowsToObjects(rows: readonly CsvRow[]): {
  headers: string[];
  objects: Record<string, string>[];
} {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) {
    return { headers: [], objects: [] };
  }

  const headers = headerRow.map(normalizeHeader);
  const objects = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );

  return { headers, objects };
}
