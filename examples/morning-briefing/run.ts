/**
 * Run the morning briefing example with the attune() API.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/morning-briefing/run.ts
 */

import { attune, anthropic } from "../../src/index.js";
import { RSS_ITEMS, INITIAL_PROMPT } from "./data.js";

const NUM_RUNS = 5;

async function main() {
  const loop = attune({
    task: "Generate a morning briefing from RSS items",
    prompt: INITIAL_PROMPT,
    dimensions: {
      relevance: { weight: 0.30, description: "How well do the selected items match the user's stated interests?" },
      specificity: { weight: 0.20, description: "Are summaries concrete and information-dense, or vague and generic?" },
      diversity: { weight: 0.20, description: "Do items cover different topics/sources, or cluster on one thing?" },
      actionability: { weight: 0.15, description: "Can the user do something with this info (learn, decide, act)?" },
      conciseness: { weight: 0.15, description: "Is the briefing tight, or does it waste words?" },
    },
    input: RSS_ITEMS,
    memory: "./.attune-morning-briefing/",
    llm: anthropic("claude-sonnet-4-20250514"),
  });

  console.log("=== Morning Briefing (v2 Architecture) ===");
  console.log(`Running ${NUM_RUNS} attuning cycles\n`);

  for (let i = 0; i < NUM_RUNS; i++) {
    console.log(`--- Cycle ${i + 1}/${NUM_RUNS} ---`);
    const start = Date.now();
    const record = await loop.step();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`  Time: ${elapsed}s`);
    console.log(`  Composite: ${record.score.dimensions.composite}`);
    for (const [dim, val] of Object.entries(record.score.dimensions)) {
      if (dim !== "composite") {
        console.log(`    ${dim.padEnd(15)} ${val}`);
      }
    }
    if (record.patches.length > 0) {
      console.log(`  Patches: ${record.patches.map((p) => `${p.operation} ${p.file}`).join(", ")}`);
    }
    console.log();
  }

  console.log("=== Done ===");
  console.log("Memory directory: ./.attune-morning-briefing/");
}

main().catch(console.error);
