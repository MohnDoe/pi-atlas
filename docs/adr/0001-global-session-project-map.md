# Global mutable sessionProjectMap for cost attribution

**Status: OBSOLETE** — Replaced by per-`SessionAgg.project` field (PRD-0003 Phase 1). Each session now carries its own `project` field, eliminating the global mutable state.

Cost attribution to projects uses a module-level `sessionProjectMap: Map<string, string>` in `parser.ts`. When a `session` entry is parsed (containing `cwd`), the session ID is mapped to a project name. Subsequent `assistant` messages in the same file attribute their cost to all active projects in `sessionProjectMap`. The map is reset at the start of each `parseFile()` call.

This keeps cost attribution simple — parse functions don't need to carry a context object through the call chain — at the cost of global mutable state that's invisible to callers of individual `parse*()` functions.

**Trade-off**: Accepting mutable global state in the parser was cleaner than threading a `SessionProjectMap` through every `parse*()` function and returning it alongside every `DayAgg`. The alternative would bundle the map with DayAgg into a `ParseResult { days, sessionMap }` type and thread it through the entire call chain. The current approach keeps function signatures pure-looking `(entry) → DayAgg` while the map is implicitly available.

**Consequences**: Calling `parseSessionEntry()`, `parseUserMessage()`, etc. outside of a `parseFile()` lifecycle (e.g., in unit tests) will not have the expected project mapping. Tests that exercise cost attribution must set up `sessionProjectMap` first or go through `parseFile()`.
