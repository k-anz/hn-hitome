import { describe, expect, it } from "vitest";
import { formatComments, type CommentNode } from "../src/comments";

const c = (text: string | null, children: CommentNode[] = []): CommentNode => ({ text, children });
const opts = { maxTopLevel: 20, maxReplyDepth: 2, maxChars: 10_000 };

describe("formatComments", () => {
  it("階層をインデントで表す", () => {
    const tree = [c("top", [c("reply", [c("deep")])])];
    expect(formatComments(tree, opts)).toBe("- top\n  - reply\n    - deep");
  });

  it("返信は maxReplyDepth 階層まで", () => {
    const tree = [c("0", [c("1", [c("2", [c("3")])])])];
    expect(formatComments(tree, opts)).not.toContain("- 3");
  });

  it("トップレベルは maxTopLevel 件まで", () => {
    const tree = [c("a"), c("b"), c("c")];
    expect(formatComments(tree, { ...opts, maxTopLevel: 2 })).toBe("- a\n- b");
  });

  it("削除済みは出さないが、その返信は残す", () => {
    const tree = [c(null, [c("orphan")])];
    expect(formatComments(tree, opts)).toBe("  - orphan");
  });

  it("HTML を除き、改行は空白にまとめる", () => {
    expect(formatComments([c("a<p>b &amp; c")], opts)).toBe("- a b & c");
  });

  it("maxChars を超える前で打ち切る", () => {
    const tree = [c("x".repeat(10)), c("y".repeat(10)), c("z".repeat(10))];
    // 1 行 = "- " + 10 文字 = 12 文字 + 改行
    expect(formatComments(tree, { ...opts, maxChars: 30 })).toBe(`- ${"x".repeat(10)}\n- ${"y".repeat(10)}`);
  });
});
