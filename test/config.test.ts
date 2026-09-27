import { describe, expect, it } from "vitest";
import { DEFAULT_API_URL, DEFAULT_TIMEOUT_MS, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses defaults", () => {
    expect(loadConfig({})).toEqual({ apiUrl: DEFAULT_API_URL, timeoutMs: DEFAULT_TIMEOUT_MS });
  });

  it("strips trailing slashes and keeps a path prefix", () => {
    expect(loadConfig({ ARCID_API_URL: "http://127.0.0.1:4000/" }).apiUrl).toBe("http://127.0.0.1:4000");
    expect(loadConfig({ ARCID_API_URL: "https://x.dev/arcid//" }).apiUrl).toBe("https://x.dev/arcid");
  });

  it("rejects invalid URLs and protocols", () => {
    expect(() => loadConfig({ ARCID_API_URL: "not a url" })).toThrow(/not a valid URL/);
    expect(() => loadConfig({ ARCID_API_URL: "ftp://x.dev" })).toThrow(/http\(s\)/);
  });

  it("validates the timeout", () => {
    expect(loadConfig({ ARCID_TIMEOUT_MS: "5000" }).timeoutMs).toBe(5000);
    for (const bad of ["abc", "10", "999999", "1.5"]) {
      expect(() => loadConfig({ ARCID_TIMEOUT_MS: bad })).toThrow(/ARCID_TIMEOUT_MS/);
    }
  });
});
