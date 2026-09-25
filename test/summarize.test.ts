import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { buildUserPrompt, createClaudeSummarizer, extractSummary, fakeSummarizer } from "../src/summarize";

const summary = { titleJa: "t", summaryJa: "s", discussionPointsJa: ["p"] };
const input = { title: "Title", sourceStatus: "full" as const, articleText: "BODY", commentsText: "- c" };

describe("buildUserPrompt", () => {
  it("タイトル・本文・コメントを含む", () => {
    const p = buildUserPrompt(input);
    expect(p).toContain("Title");
    expect(p).toContain("BODY");
    expect(p).toContain("- c");
  });

  it("本文がないときは推測である旨を書くよう指示する", () => {
    const p = buildUserPrompt({ ...input, sourceStatus: "unavailable", articleText: null });
    expect(p).toContain("本文は取得できませんでした");
  });
});

describe("extractSummary", () => {
  it("end_turn なら parsed_output を返す", () => {
    expect(extractSummary({ stop_reason: "end_turn", parsed_output: summary })).toEqual(summary);
  });

  it("end_turn 以外は失敗", () => {
    expect(() => extractSummary({ stop_reason: "max_tokens", parsed_output: summary })).toThrow("max_tokens");
    expect(() => extractSummary({ stop_reason: "refusal", parsed_output: null })).toThrow("refusal");
  });

  it("parsed_output が null なら失敗", () => {
    expect(() => extractSummary({ stop_reason: "end_turn", parsed_output: null })).toThrow();
  });
});

describe("createClaudeSummarizer", () => {
  it("モデル名と構造化出力を指定して呼び、結果を返す", async () => {
    const calls: unknown[] = [];
    const client = {
      messages: {
        parse: async (params: unknown) => {
          calls.push(params);
          return { stop_reason: "end_turn", parsed_output: summary, usage: { input_tokens: 1, output_tokens: 2 } };
        },
      },
    } as unknown as Anthropic;
    const logs: string[] = [];
    const summarize = createClaudeSummarizer(client, "claude-sonnet-5", (m) => logs.push(m));
    expect(await summarize(input)).toEqual(summary);
    expect(calls[0]).toMatchObject({ model: "claude-sonnet-5", output_config: { format: expect.anything() } });
    expect(logs.join()).toContain("in=1");
  });
});

describe("fakeSummarizer", () => {
  it("API を呼ばずに形だけ合った結果を返す", async () => {
    const s = await fakeSummarizer(input);
    expect(s.titleJa).toContain("Title");
    expect(s.discussionPointsJa.length).toBeGreaterThan(0);
  });
});
