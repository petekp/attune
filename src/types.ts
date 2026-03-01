// The core domain model for attune. Every type here is a plain data shape
// with no behavior. They flow between components as the currency of the
// attuning loop.
//
// The key insight: all state is document-native. Memory is markdown files
// with YAML frontmatter, not database rows or opaque blobs. This makes
// the system's state human-readable and version-controllable.

/** A markdown file with YAML frontmatter and a body. */
export interface MemoryFile {
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

/** Lightweight view of a file: frontmatter only, no body. */
export interface FileManifest {
  path: string;
  frontmatter: Record<string, unknown>;
}

/** A file-level change proposed by the Adapter. */
export interface MemoryPatch {
  file: string;
  operation: "create" | "update" | "append";
  content: MemoryFile;
  rationale: string;
}

/** A frozen copy of the memory directory at a point in time. */
export interface MemorySnapshot {
  id: string;
  files: MemoryFile[];
  timestamp: Date;
}

/** The artifact a single run produces. Opaque to the framework. */
export interface Output {
  runId: string;
  data: unknown;
}

/** A piece of feedback about an Output. */
export interface Signal {
  runId: string;
  source: "human" | "behavioral" | "automated" | "deterministic";
  timing: "immediate" | "deferred";
  value: unknown;
}

/** A quantified assessment of Output quality. */
export interface Score {
  runId: string;
  dimensions: Record<string, number>;
}

/** A complete record of one attuning cycle. */
export interface RunRecord {
  id: string;
  memorySnapshot: MemorySnapshot;
  output: Output;
  score: Score;
  signals: Signal[];
  patches: MemoryPatch[];
  timestamp: Date;
}

/** A quality dimension with a weight and description. */
export interface DimensionConfig {
  weight: number;
  description: string;
}

/** Per-dimension score with feedback from the judge. */
export interface DimensionScore {
  score: number;
  feedback: string;
}

/** The rubric signal value produced by RubricJudge. */
export interface RubricSignalValue {
  dimensions: Record<string, DimensionScore>;
  weakest: { name: string; score: number; feedback: string };
}
