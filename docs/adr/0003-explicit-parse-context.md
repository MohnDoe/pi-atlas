# Explicit ParseContext for skill tracking

Parser had a module-level `activeSkill` variable that parsed messages implicitly read and wrote. This was invisible coupling — the interface claimed pure `(msg) → SessionAgg` but behaviour changed based on prior calls in the same `parseFile()` scope.

We replaced it with an explicit immutable `ParseContext` threaded through every parse function via `(msg, ctx) → ParseResult`. The context carries `{ activeSkill: SkillState | null }` where `SkillState = { name: string; counted: boolean }`. `parseFile()` owns the lifecycle — creates it, threads it, discards it. No module-level state remains.

**Considered:** mutable context passed by reference. Rejected because callers can't see when state changes — the same invisibility problem, just scoped.

**Consequences:** every parse function now returns `{ session: SessionAgg, ctx: ParseContext }`. This adds a destructuring step at ~20 call sites but makes the skill-tracking seam visible to every caller and testable without side-channel accessors.
