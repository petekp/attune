// Public API surface for attune. Exports are organized by the three
// layers of progressive disclosure:
//
//   Layer 1: attune() is config-in, loop-out. Most users stop here.
//   Layer 2: RunLoop + default components let you swap individual pieces.
//   Layer 3: Raw interfaces let you implement everything yourself.

// Config-first API (Layer 1)
export { attune } from "./attune.js";
export type { AttuneConfig } from "./attune.js";

// RunLoop (Layer 2-3)
export { RunLoop } from "./run-loop.js";
export type { RunLoopConfig } from "./run-loop.js";

// Core types
export type {
  MemoryFile,
  FileManifest,
  MemoryPatch,
  MemorySnapshot,
  Output,
  Signal,
  Score,
  RunRecord,
  DimensionConfig,
  DimensionScore,
  RubricSignalValue,
} from "./types.js";

// Seam interfaces
export type {
  TaskLoop,
  Evaluator,
  SignalCollector,
  Adapter,
  LLMClient,
  MemoryStore,
} from "./interfaces.js";

// Memory directory
export { MemoryDirectory } from "./memory-directory.js";

// LLM clients
export { AnthropicLLMClient, anthropic } from "./llm.js";

// Default components (for Layer 2 overrides)
export { PromptTaskLoop } from "./defaults/prompt-task-loop.js";
export { RubricJudge } from "./defaults/rubric-judge.js";
export { RubricEvaluator } from "./defaults/rubric-evaluator.js";
export { JournalingAdapter } from "./defaults/journaling-adapter.js";

// Utilities
export { parseJSON } from "./parse-json.js";
