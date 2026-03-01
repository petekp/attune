// The Layer 1 entry point. A single function that turns a config object
// into a running attuning loop. This is where most users start:
//
//   const loop = attune({ task, prompt, dimensions, input, memory, llm });
//   const result = await loop.step();
//
// Under the hood, attune() wires up all the default components
// (PromptTaskLoop, RubricJudge, RubricEvaluator, JournalingAdapter)
// and seeds the memory directory with the initial prompt. Users who
// need more control can override individual components via the config,
// or drop down to Layer 2 (RunLoop) or Layer 3 (raw interfaces).

import { MemoryDirectory } from "./memory-directory.js";
import { RunLoop } from "./run-loop.js";
import { PromptTaskLoop } from "./defaults/prompt-task-loop.js";
import { RubricJudge } from "./defaults/rubric-judge.js";
import { RubricEvaluator } from "./defaults/rubric-evaluator.js";
import { JournalingAdapter } from "./defaults/journaling-adapter.js";
import type { LLMClient, TaskLoop, Evaluator, SignalCollector, Adapter } from "./interfaces.js";
import type { DimensionConfig } from "./types.js";

export interface AttuneConfig {
  /** Human-readable description of the task (used in evaluation prompts). */
  task: string;
  /** Initial system prompt for the AI. */
  prompt: string;
  /** Quality dimensions with weights and descriptions. */
  dimensions: Record<string, DimensionConfig>;
  /** Input data fed to the task each cycle. */
  input: unknown;
  /** Path to the memory directory. */
  memory: string;
  /** LLM client to use. */
  llm: LLMClient;
  /** Optional component overrides. */
  taskLoop?: TaskLoop;
  evaluator?: Evaluator;
  signalCollectors?: SignalCollector[];
  adapter?: Adapter;
}

export function attune(config: AttuneConfig): RunLoop {
  const memory = new MemoryDirectory(config.memory);

  // Initialize prompt.md if the directory is empty
  const initPromise = memory.listFiles().then(async (files) => {
    if (!files.includes("prompt.md")) {
      await memory.writeFile("prompt.md", {
        path: "prompt.md",
        frontmatter: {
          type: "prompt",
          version: 0,
          updated: new Date().toISOString().split("T")[0],
        },
        body: config.prompt,
      });
    }
  });

  const taskLoop = config.taskLoop ?? new PromptTaskLoop(config.input, config.llm);
  const evaluator = config.evaluator ?? new RubricEvaluator(config.dimensions);
  const signalCollectors = config.signalCollectors ?? [new RubricJudge(config.dimensions, config.llm)];
  const adapter = config.adapter ?? new JournalingAdapter(config.llm);

  const loop = new RunLoop({
    taskLoop,
    evaluator,
    signalCollectors,
    adapter,
    memory,
  });

  // Lazy initialization: prompt.md seeding runs concurrently with setup,
  // but must complete before the first step() executes. After that, the
  // wrapper is a no-op. This avoids blocking attune() itself on I/O.
  const originalStep = loop.step.bind(loop);
  let initialized = false;
  loop.step = async () => {
    if (!initialized) {
      await initPromise;
      initialized = true;
    }
    return originalStep();
  };

  return loop;
}
