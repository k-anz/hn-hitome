import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dayPath } from "./digest";
import { renderDayHtml, renderIndexHtml, renderJson } from "./render";
import { Digest, digestJsonSchema } from "./schema";

async function writeText(
  dir: string,
  relPath: string,
  content: string,
): Promise<void> {
  const file = path.join(dir, relPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

const DAY_JSON = /^\d{4}\/\d{2}\/\d{2}\.json$/;

/** 過去の日付 JSON を全部読む（新しい順） */
export async function readArchive(dir: string): Promise<Digest[]> {
  const files = (await readdir(dir, { recursive: true }))
    .map((f) => f.split(path.sep).join("/"))
    .filter((f) => DAY_JSON.test(f));
  const digests = await Promise.all(
    files.map(async (f) =>
      Digest.parse(JSON.parse(await readFile(path.join(dir, f), "utf8"))),
    ),
  );
  return digests.sort((a, b) => b.date.localeCompare(a.date));
}

export async function writeSchema(dir: string): Promise<void> {
  await writeText(
    dir,
    "schema.json",
    `${JSON.stringify(digestJsonSchema(), null, 2)}\n`,
  );
}

export async function publish(dir: string, digest: Digest): Promise<void> {
  const base = dayPath(digest.date);
  await writeText(dir, `${base}.json`, renderJson(digest));
  await writeText(dir, `${base}.html`, renderDayHtml(digest));
  await writeText(dir, "latest.json", renderJson(digest));
  await writeText(dir, "index.html", renderIndexHtml(await readArchive(dir)));
  await writeSchema(dir);
}
