# Explicit parse context for skill tracking

The parser's skill-tracking state (`activeSkill`) was a module-level mutable variable — invisible to callers, requiring manual `resetActiveSkills()` in tests and lifecycle management via `try/finally` blocks. Each parse function's interface claimed to be a pure `(entry) → SessionAgg` but implicitly read and wrote the module-level state.

We replaced it with an explicit `ParseContext` interface (`{ activeSkill: SkillState | null }`) threaded through every parse function. Each parse function now takes `(entry, ctx) → ParseResult = { session, ctx }`. `parseFile()` creates and owns the context lifecycle. The context is immutable — mutations produce a new context value returned alongside the session.

**Rejected alternatives**: (a) A mutable ParseContext passed by reference (simpler but hides mutation), (b) Keeping module-level state with a context object for thread-safety (least invasive but perpetuates the invisible-coupling pattern).

**Consequences**: Every parse function's signature changed — ~20 call sites updated. `getActiveSkill()` and `resetActiveSkills()` removed from the module's public surface. Tests no longer need `beforeEach(resetActiveSkills)`. The `counted` flag lives in SkillState inside ParseContext, maintaining the same "increment call count once per skill invocation" semantics.
