import { describe, expect, it } from "bun:test";
import {
  bumpVersion,
  isValidVersion,
  readVersionField,
  replaceVersionField,
} from "../scripts/version.js";

describe("bumpVersion", () => {
  it("bumps each level and resets the lower ones", () => {
    expect(bumpVersion("0.2.9", "patch")).toBe("0.2.10");
    expect(bumpVersion("0.2.9", "minor")).toBe("0.3.0");
    expect(bumpVersion("0.2.9", "major")).toBe("1.0.0");
  });

  it("rejects versions that are not major.minor.patch", () => {
    expect(() => bumpVersion("1.2", "patch")).toThrow("not a major.minor.patch version");
  });
});

describe("isValidVersion", () => {
  it("accepts plain integer triples only", () => {
    expect(isValidVersion("1.4.0")).toBe(true);
    expect(isValidVersion("01.4.0")).toBe(false);
    expect(isValidVersion("1.4.0-beta")).toBe(false);
    expect(isValidVersion("1.4")).toBe(false);
  });
});

describe("version field editing", () => {
  const manifest = `{
  "manifest_version": 3,
  "name": "FeedTubes",
  "version": "0.2.0",
  "browser_specific_settings": { "gecko": { "strict_min_version": "159.0" } }
}
`;

  it("reads the top-level version", () => {
    expect(readVersionField(manifest, "manifest.json")).toBe("0.2.0");
  });

  it("replaces only the version and keeps the formatting", () => {
    expect(replaceVersionField(manifest, "0.3.0")).toBe(manifest.replace('"0.2.0"', '"0.3.0"'));
  });

  it("names the file when there is no version", () => {
    expect(() => readVersionField("{}", "package.json")).toThrow('package.json has no "version"');
  });
});
