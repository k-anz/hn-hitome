import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recordingFetch } from "../src/recording";
import { fakeFetch } from "./helpers";

describe("recordingFetch", () => {
  it("本文を保存しつつ、呼び出し側にもそのまま返す", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "rec-"));
    const f = recordingFetch(fakeFetch({ "https://x.test": { a: 1 } }), dir);
    const res = await f("https://x.test/v0/item/1.json");
    expect(await res.json()).toEqual({ a: 1 });
    const files = await readdir(dir);
    expect(files).toEqual(["x_test_v0_item_1_json"]);
    expect(JSON.parse(await readFile(path.join(dir, files[0]!), "utf8"))).toEqual({ a: 1 });
  });
});
