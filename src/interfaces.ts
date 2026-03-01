// The six seam interfaces that define attune's pluggable architecture.
// Each interface represents a single responsibility in the attuning loop.
// Consumers pick their layer of control:
//
//   Layer 1: attune() takes a config object; all defaults wired for you
//   Layer 2: new RunLoop() lets you swap individual components via these interfaces
//   Layer 3: implement interfaces directly for full control
//
// The compatibility contract: TaskLoop + MemoryStore + Adapter must agree
// on the shape of memory files. Evaluator and SignalCollector are
// independently swappable because they only read Output and Signal.

import type { MemoryFile, MemoryPatch, FileManifest, MemorySnapshot, Output, Signal, Score } from "./types.js";

/** Reads and writes the memory directory, the persistent state layer. */
export interface MemoryStore {
  readFile(relativePath: string): Promise<MemoryFile>;
  writeFile(relativePath: string, file: MemoryFile): Promise<void>;
  scanFrontmatter(glob?: string): Promise<FileManifest[]>;
  listFiles(glob?: string): Promise<string[]>;
  getPrompt(): Promise<MemoryFile>;
  getJournal(): Promise<MemoryFile>;
  snapshot(): Promise<MemorySnapshot>;
  applyPatches(patches: MemoryPatch[]): Promise<void>;
}

/** Executes the task using memory as context. */
export interface TaskLoop {
  execute(memory: MemoryStore): Promise<Output>;
}

/** Scores output quality from signals. */
export interface Evaluator {
  evaluate(output: Output, signals: Signal[]): Promise<Score>;
}

/** Collects feedback signals about an output. */
export interface SignalCollector {
  collect(output: Output): Promise<Signal[]>;
}

/** Proposes memory changes based on signals and current memory. */
export interface Adapter {
  adapt(signals: Signal[], score: Score, memory: MemoryStore): Promise<MemoryPatch[]>;
}

/** Provider-agnostic LLM interface with structured messages. */
export interface LLMClient {
  complete(params: {
    system?: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }): Promise<string>;
}
