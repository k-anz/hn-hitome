import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("既定値", () => {
    const c = loadConfig({});
    expect(c.itemCount).toBe(3);
    expect(c.model).toBe("claude-sonnet-5");
    expect(c.pagesBaseUrl).toBe("https://k-anz.github.io/hn-hitome");
    expect(c.comments).toEqual({
      maxTopLevel: 20,
      maxReplyDepth: 2,
      maxChars: 30_000,
    });
  });

  it("環境変数で上書きし、末尾スラッシュを落とす", () => {
    const c = loadConfig({
      ITEM_COUNT: "5",
      MODEL: "m",
      PAGES_BASE_URL: "https://x.test/y/",
    });
    expect(c.itemCount).toBe(5);
    expect(c.model).toBe("m");
    expect(c.pagesBaseUrl).toBe("https://x.test/y");
  });

  it("空文字は未設定扱い（Actions の未定義 vars 対策）", () => {
    expect(loadConfig({ PAGES_BASE_URL: "", ITEM_COUNT: "" }).itemCount).toBe(
      3,
    );
  });
});
