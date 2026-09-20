# Example scores

The scores the editor **ships with** — what File ▸ Examples opens.

One file per example, in the score-file envelope `utils/scoreFile` already reads and
`File ▸ Export JSON` already writes: an exported score dropped in here is an example, with no
conversion step and no second format. ⛔ Not a raw `Score` — the envelope is what `readScoreFile`
checks, and report-never-repair (`docs/plans/json-io-plan.md`) means a bare model is refused, not fixed up.

## Why `public/`, not `src/`

These are **fetched at run time**, the way `public/smufl/*.json` is (`windows/symbols/smufl.ts`), not
imported. Vite serves this directory verbatim in dev and copies it into `dist/` on build, so one path
works in both: `${baseUrl()}examples/<file>`. Importing them instead would bake every example into
the main bundle — which is already 2 MB — for scores most sessions never open.

## Adding one

1. Build the score in the editor, then **File ▸ Export JSON**.
2. Drop the file here under a plain lowercase-hyphen name (`fanned-beams.json`).
3. Add its row to `EXAMPLES` in `src/menus/examplesMenu.ts` — `{ id, label, file }`. The submenu is
   painted from that table, so the row IS the menu change; nothing else moves.

⚠️ The rows stay greyed until the opener exists: `openExample` on `menuActions`, going through the
same load path Import uses (`interactions/scoreFileIo.ts` — `beforeLoad` clears the selection,
`afterLoad` re-renders). ⛔ Never a second loader.

An example is there to SHOW something — a fanned beam, a four-voice bar, an ottava spanning a system
break. Keep each one short and about one thing; a demo shelf is not a library.
