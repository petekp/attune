// LLMs don't always return clean JSON. They often wrap it in markdown
// code fences or add conversational text around it. This utility tries
// three extraction strategies in order:
//   1. Direct parse (clean JSON)
//   2. Code fence extraction (```json ... ```)
//   3. Embedded object/array matching ({ ... } or [ ... ])

/**
 * Extract and parse JSON from an LLM response that may include
 * markdown code fences or other surrounding text.
 *
 * Returns the parsed object or throws if no valid JSON can be found.
 */
export function parseJSON<T>(raw: string): T {
  // Strategy 1: the response is already valid JSON
  try {
    return JSON.parse(raw);
  } catch {
    // Strategy 2: JSON wrapped in markdown code fences
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      return JSON.parse(fenceMatch[1].trim());
    }

    // Strategy 3: JSON object or array embedded in prose
    const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    throw new Error(`Could not extract JSON from LLM response: ${raw.slice(0, 200)}`);
  }
}
