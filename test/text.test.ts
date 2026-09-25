import { describe, expect, it } from "vitest";
import { htmlToText } from "../src/text";

describe("htmlToText", () => {
  it("段落を改行にし、タグを除き、実体参照を戻す", () => {
    const html = `I&#x27;d say <i>no</i>.<p>See <a href="https:&#x2F;&#x2F;x.com">link</a> &amp; &quot;more&quot;`;
    expect(htmlToText(html)).toBe(`I'd say no.\n\nSee link & "more"`);
  });

  it("不正な数値参照はそのまま残す", () => {
    expect(htmlToText("a &#99999999; b")).toBe("a &#99999999; b");
  });
});
