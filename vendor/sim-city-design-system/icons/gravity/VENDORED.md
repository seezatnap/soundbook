# Vendored: @gravity-ui/icons

- Source: https://github.com/gravity-ui/icons
- Version: v2.21.0 (tag), fetched 2026-08-14
- License: MIT (Yandex LLC) — see `LICENSE` in this directory
- Contents: the complete `svgs/` set (799 icons), byte-identical to the
  upstream tag. No npm dependency; the SVGs are the distribution.

`PixelIcon` (../PixelIcon.tsx) is the only consumer: it maps the design
system's icon vocabulary onto these files and inlines the ones it uses at
build time via `?raw` imports. To use an icon outside the current
vocabulary, add a mapping there — do not edit files under `svgs/`.

Updating: replace `svgs/` and `LICENSE` wholesale from a newer tag, update
the version line above, and log the change in ../../LOCAL_CHANGELOG.md.
