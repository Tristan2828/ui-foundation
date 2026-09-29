import { describe, expect, it } from "vitest";
import { returnPath } from "../src/routes/return-path";

describe("returnPath", () => {
  it("returns the in-app path AppShell redirected away from", () => {
    expect(returnPath({ from: "/widgets?page=2#top" })).toBe("/widgets?page=2#top");
  });

  it("falls back to home when there is no state", () => {
    expect(returnPath(null)).toBe("/");
    expect(returnPath(undefined)).toBe("/");
    expect(returnPath({})).toBe("/");
  });

  it("never returns an off-site destination", () => {
    for (const from of ["https://evil.example", "//evil.example", "evil", 42]) {
      expect(returnPath({ from })).toBe("/");
    }
  });
});
