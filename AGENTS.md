# Agent notes

Read `CLAUDE.md` first — it holds the hard rules (seeded randomness, one
AudioContext, pure chunk-independent events, the vendored design system
protocol) and the check commands. This file indexes the project's skills.

## Skills

Skills live in `.claude/skills/<name>/SKILL.md`. Invoke them before doing
the task they cover; they encode protocol that is easy to violate silently.

| Skill | Use when |
| --- | --- |
| `new-lab` | Adding any Soundbook lab or param to one: flat labs, compositions, or console labs that embed other labs (DroneLab). Covers determinism rules, param groups (tabbed panels of 5–10 params), key collisions between embedded schemas, sub-instrument wiring, derived subseeds, loop wrapping, registration, and the required tests. |
| `code-export` | Keeping every feature exportable as standalone audio code (the CODE button: `index.html` + `<lab>.js`, no visuals). Covers the `index.ts` / `stage.ts` split, the React-free lab rule, what must be mirrored in `src/export/runtime.ts` when the shell gains a playback behavior, the comment-preserving linker / Vite plugin / CLI, and the export test suite. Read it for any change to a lab, an instrument, transport behavior, or `src/export`. |

When a task teaches you a repeatable protocol this table doesn't cover,
add a skill for it and list it here.
