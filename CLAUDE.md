# attune

An open-source adaptive runtime for recurring AI tasks. Sits between an AI-powered product and its users, improving behavior over time by observing outputs, scoring quality, and evolving configuration.

## Governing principles

- **State is files.** Markdown with YAML frontmatter on disk. No database, no generic type parameters. Users can read, edit, and version-control the AI's learned state with standard tools.
- **Progressive disclosure.** Layer 1: config object. Layer 2: swap individual components. Layer 3: implement all interfaces. Same system, different entry points.
- **Single adaptation loop.** One adapter handles both prompt evolution and memory accumulation. No parallel mechanisms that create attribution ambiguity.
- **Seams over abstractions.** Components are pluggable interfaces (TaskLoop, Evaluator, SignalCollector, Adapter, MemoryStore, LLMClient). Swap any piece without touching others.
- **Self-referential.** The adapter's journal is just another file in the memory directory. No special mechanism needed for the system to learn from its own history.

## Running

```bash
pnpm test                    # Run test suite
pnpm run briefing            # Run morning briefing example (requires ANTHROPIC_API_KEY)
```
