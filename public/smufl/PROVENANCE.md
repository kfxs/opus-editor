# SMuFL metadata

`glyphnames.json`, `ranges.json` and `classes.json` are the Standard Music Font Layout's own
metadata files, taken **verbatim** — no edits, no trimming — from the specification repository on
2026-07-22:

    https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/<file>

SMuFL is maintained by the [W3C Music Notation Community Group](https://www.w3.org/community/music-notation/).
The repository carries no `LICENSE` file; the specification and its metadata are published by that
group as part of the SMuFL spec, and are used here unmodified and attributed. If we ever
redistribute these beyond the app, check the group's current terms first rather than assuming.

They are **fetched at runtime** by `src/windows/symbols/smufl.ts` (the Symbols window), never
bundled — see `docs/symbols-window-plan.md`. Re-download rather than hand-edit: any local change to
these files would be a silent fork of the specification.

The music font itself is elsewhere — `public/fonts/Bravura.otf`, under SIL OFL 1.1 (`OFL.txt`).
