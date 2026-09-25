import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Fetch } from "./hn";

/** 取得したレスポンスをファイルに残す fetch（テスト用 fixture 集め） */
export function recordingFetch(inner: Fetch, dir: string): Fetch {
  return async (input, init) => {
    const res = await inner(input, init);
    const url = input instanceof Request ? input.url : String(input);
    const name = url
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .slice(0, 150);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), await res.clone().text());
    return res;
  };
}
