export function parseCsv(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => value.trim() !== ""));
}

function escapeCsvField(value) {
  let text = String(value ?? "");
  if (/^[=+-]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeCsv(rows) {
  return `${rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n")}\r\n`;
}

export function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, "");
}

export function rowsToObjects(rows) {
  if (rows.length === 0) {
    return { headers: [], objects: [] };
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const objects = rows.slice(1).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index] ?? "";
    });
    return object;
  });

  return { headers, objects };
}
