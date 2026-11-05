import { describe, expect, it } from "bun:test";
import { normalizeHeader, parseCsv, rowsToObjects, serializeCsv } from "../src/lib/csv.js";

describe("parseCsv", () => {
  it("parses quoted fields, commas, doubled quotes, and newlines", () => {
    const rows = parseCsv(
      '\uFEFFChannel Id,Channel Url,Channel Title\r\n"UC1","https://example.com/a,b","A ""quoted"" name"\r\nUC2,https://example.com/c,"Line\nbreak"\r\n'
    );

    expect(rows).toEqual([
      ["Channel Id", "Channel Url", "Channel Title"],
      ["UC1", "https://example.com/a,b", 'A "quoted" name'],
      ["UC2", "https://example.com/c", "Line\nbreak"],
    ]);
  });

  it("accepts LF and skips blank rows", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("serializeCsv", () => {
  it("quotes every field and neutralizes spreadsheet formulas", () => {
    const text = serializeCsv([
      ["name", "value"],
      ["=SUM(A1:A2)", "-1"],
    ]);

    expect(text).toBe('"name","value"\r\n"\'=SUM(A1:A2)","\'-1"\r\n');
  });
});

describe("rowsToObjects", () => {
  it("normalizes headers into lookup keys", () => {
    const result = rowsToObjects([
      ["Channel ID", "Feed-URL"],
      ["UC1", "https://example.com/feed"],
    ]);

    expect(normalizeHeader("Channel ID")).toBe("channelid");
    expect(result.objects).toEqual([
      {
        channelid: "UC1",
        feedurl: "https://example.com/feed",
      },
    ]);
  });
});
