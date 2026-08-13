# INSTRUCTIONS — read before touching anything in this directory

This is a **vendored copy** of the SIM CITY DESIGN SYSTEM, unpacked from a
versioned tarball (see `VERSION`). It is not source of truth. Local
modification is allowed, but only under the protocol below — the protocol is
what lets your changes flow back upstream instead of dying in this folder.

**If you are an AI agent working in this repository: this file is your
contract for this directory. Follow it exactly.**

## The three rules

1. **Every change to any file in this tree MUST be logged in
   `LOCAL_CHANGELOG.md`** (append-only, format below) in the same commit.
2. **Verify before you commit:** run

   ```sh
   node <this-directory>/check-local-changes.mjs
   ```

   It compares every file against `MANIFEST.txt` and fails if anything
   changed without a changelog entry claiming it. Undocumented drift is a
   defect; fix the log, not the checker.
3. **Never edit the machinery:** `VERSION`, `MANIFEST.txt`, `env.d.ts`,
   `check-local-changes.mjs`, `INSTRUCTIONS.md` (this file), and
   `DESIGN.md` are off limits. `LOCAL_CHANGELOG.md` is append-and-stamp
   only — never rewrite or delete existing entries.

## Before you modify: is a local edit even right?

- **Theming/colors**: do NOT edit `tokens/tokens.css`. Redefine the custom
  properties in your app's own CSS, after importing tokens. That is the
  supported theming mechanism and needs no changelog.
- **New app-specific components**: build them in your app, composing the
  vendored ones. Only edit this tree to fix or extend the system itself.
- **Genuine bugs / missing props / new variants**: yes — edit here, log it,
  and mark it `Upstream: candidate` so it gets folded back.

## LOCAL_CHANGELOG.md entry format (machine-parsed — keep it exact)

```markdown
## [LOCAL] 2026-07-27 numberfield-stepper-hitbox
Files:
- components/NumberField/NumberField.css
- components/NumberField/NumberField.tsx
Reason: steppers were unreachable for touch users in the permit kiosk.
Change: stepper hit area widened to 20px; arrows unchanged visually.
Upstream: candidate
```

- Header: `## [LOCAL] YYYY-MM-DD kebab-slug` — exactly.
- `Files:` — one `- path` per line, relative to this directory, every file
  you touched (created files too; note deletions as `- path (deleted)`).
- `Upstream:` — `candidate` (should be folded back), `hold` (not ready), or
  `never` (deliberately app-specific; expect to re-apply it after every
  update forever — prefer not to have these).
- Append new entries at the **top**, below the header block.

Do not create `[UPSTREAMED …]` or `[REJECTED …]` entries yourself — those
stamps are applied by the upstream maintainer's tooling when your entries
are folded back.

## Updating to a new upstream version

`LOCAL_CHANGELOG.md` survives; your unstamped edits must be re-applied.

```sh
V=vendor/sim-city-design-system
node $V/check-local-changes.mjs          # know your local state first
cp $V/LOCAL_CHANGELOG.md /tmp/lcl.md     # preserve the log
rm -rf $V && tar -xzf <new-tarball> -C vendor
mv /tmp/lcl.md $V/LOCAL_CHANGELOG.md     # restore the log
node $V/check-local-changes.mjs          # expect: entries stamped
                                         # [UPSTREAMED] are now clean;
                                         # [LOCAL] entries report missing —
                                         # re-apply those edits, then re-run
```

After re-applying still-relevant `[LOCAL]` edits, the checker must pass.
If an `[UPSTREAMED]` stamp arrived for an entry, its edit is already in the
new tarball — do not re-apply it.

## How upstreaming works (for context)

The upstream repo runs a backport tool against this directory. It refuses to
proceed if the checker fails, three-way-merges each claimed file into the
upstream source, and stamps the folded entries here as
`## [UPSTREAMED vX.Y.Z] …`. Your job is only: honest entries, passing
checker.

## Wire this file into your agents

Add this to the consuming repo's `CLAUDE.md` (or equivalent agent config):

```markdown
## Vendored design system
`vendor/sim-city-design-system/` is a vendored library with a modification
protocol. Before editing ANY file under it, read
`vendor/sim-city-design-system/INSTRUCTIONS.md` and follow it exactly —
every edit needs a LOCAL_CHANGELOG.md entry and a clean
`node vendor/sim-city-design-system/check-local-changes.mjs`.
```
