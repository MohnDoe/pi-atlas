# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** — read ADRs that touch the area you're about to work in
- **`node_modules/@earendil-works/pi-tui/README.md`** — pi-tui framework docs (Component interface, built-in components, rendering pipeline). Always read before designing or modifying TUI components.
- **`node_modules/@earendil-works/pi-tui/dist/index.d.ts`** — pi-tui type declarations for exact API signatures.
- **`node_modules/@earendil-works/pi-coding-agent/docs/session-format.md`** — pi session JSONL format: all entry types (SessionHeader, MessageEntry, CompactionEntry, etc.), AgentMessage roles (user/assistant/toolResult), Usage/cost structure, content blocks. Critical reference for parser code — the project's own types.ts mirrors this.
- **`node_modules/@earendil-works/pi-coding-agent/docs/tui.md`** — pi-specific TUI docs: `ctx.ui.custom()`, component registration, focusable components.
- **`node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`** — pi extension API: `registerCommand()`, `ExtensionAPI`, `ExtensionCommandContext`, theme type, extension lifecycle.
- **`node_modules/@earendil-works/pi-coding-agent/docs/sessions.md`** — pi session storage overview (file layout under `~/.pi/agent/sessions/`).
- **`node_modules/@earendil-works/pi-coding-agent/docs/index.md`** — full doc index; read any other pages as needed.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-global-session-project-map.md
│   └── 0002-precomputed-summaries.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0002 (pre-computed summaries) — but worth reopening because…_
