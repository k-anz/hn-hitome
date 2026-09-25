import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadConfig } from "./config";
import { generateDigest } from "./pipeline";
import { publish } from "./publish";
import { recordingFetch } from "./recording";
import { createClaudeSummarizer, fakeSummarizer } from "./summarize";

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      "fake-llm": { type: "boolean", default: false },
      "save-fixtures": { type: "boolean", default: false },
    },
  });
  if (existsSync(".env")) process.loadEnvFile(".env");

  const config = loadConfig();
  const fetchFn = values["save-fixtures"] ? recordingFetch(fetch, "test/fixtures/recorded") : fetch;
  const summarize = values["fake-llm"] ? fakeSummarizer : createClaudeSummarizer(new Anthropic(), config.model);
  const outDir = values["dry-run"] ? "tmp" : "public";

  const digest = await generateDigest({ fetchFn, summarize, now: new Date(), config, log: console.log });
  await publish(outDir, digest);
  console.log(`wrote ${digest.items.length} items for ${digest.date} to ${outDir}/`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
