# Dynamics as text-as-truth

Status: **SHIPPED** — `kind: 'level' | 'text'` is deleted; a `Dynamic` is only its `text`.
Sibling of `docs/tempo-marks-plan.md` — the same collapse applied to dynamics.

## What actually shipped (differs from the original plan below)

The plan below decided a glyph run by SPELLING (a token entirely over `{f,p,m,s,z,r}`). That was
**rejected in review**: it would read a plain-typed `p` as piano. The shipped rule is stronger and
matches the user's model — *the dynamic FONT is the flag*:

- **Storage.** `text` holds the actual **SMuFL glyph characters** for the dynamic parts (minted by
  `levelToGlyphString` when a level is placed/typed) and plain ASCII for expression words. So
  `più f` is stored as `più ` + the forte glyph; a typed ASCII `p` stays a letter and is silent.
- **Detection.** `splitDynamicRuns` classifies each *character* by whether it IS a dynamics glyph
  (`utils/dynamics` owns the glyph⇄letter maps now, so there's no engine→util cycle). The level is
  `glyphsToLetters(glyphRun)` matched against `DYNAMIC_VELOCITY`. Nothing is inferred from spelling.
- **Rendering.** One Annotation per mark, drawn at the TEXT size so every mark shares one baseline
  (VexFlow places "below" by `textHeight`); a post-draw pass (`enlargeDynamicGlyphRuns`) grows the
  glyph runs to the glyph size via `<tspan>`, upward from the fixed baseline. Same helper feeds the
  ghost. `registerDynamics` rebuilds the tight bbox for any glyph-bearing mark.
- **Editor.** The in-canvas box seeds glyph runs as atomic `contenteditable="false"` chips (big
  music size) via `getSeedHtml`; typed text lands beside them at the text size. Commit stores the
  box `textContent` verbatim — glyphs stay glyphs, so the level is never dropped or invented.
- **Placement/serialization.** `dynamicTextFromTool` mints the text; palette/mouse/ghost, clipboard
  (`ClipDynamic`) and rebar (`ClipDynamicInput`) all carry only `text`.

The phase-by-phase plan below is kept for history; read the bullets above for the real design.

---

## Goal

Make every dynamic an **editable string**, so you can double-click `f` and turn it
into `f con brio`, `più f`, or edit `sfz` down to `f` — the same in-canvas text box
that already edits custom-text dynamics, now open on *all* of them.

The played loudness is **parsed out** of the string, never stored. This is the
tempo model (`utils/tempoText.ts`): the mark IS its text, the number/level is read
back from what you typed, and nothing ever rebuilds the printed text from pieces.

## Why (the model is the fix, not a new field)

Today a `Dynamic` is one of two incompatible kinds:

- `kind: 'level'` — stores `level: 'f'`, renders SMuFL glyphs (bold), drives playback.
- `kind: 'text'` — stores a free string, renders italic serif, silent.

`buildDynamicAnnotation` picks **one** font for the whole mark from `kind`. That is
exactly why `f con brio` is inexpressible: it needs the `f` bold-and-audible *and*
`con brio` italic-and-silent in one mark. Adding `prefixText`/`suffixText` fields
would keep the redundant `level` AND build a string→pieces splitter — more model,
and the "rebuild text from pieces" lie the tempo doc warns against.

Instead: **delete `kind` and `level`.** A dynamic is its `text`. The level is
derived on read by a parser. One kind, no rebuild, mixed marks fall out for free.

## The alphabet rule (rigorous, not invented)

VexFlow's `TextDynamics.GLYPHS` maps exactly six letters to SMuFL dynamic glyphs:

    { f, p, m, s, z, r }

So the boundary between "a dynamic" and "a word" is the library's own:

> A whitespace-delimited token composed **entirely** of `{f,p,m,s,z,r}` is a **glyph
> run** (renders as SMuFL glyphs). Every other token is an **italic run**.

This is self-selecting: every real expression word (`sempre`, `poco`, `meno`,
`dolce`, `più`, `con`, `brio`) contains a vowel or a consonant outside the six, so
it always lands in the italic run. The only strings that are *entirely* over those
six letters ARE dynamics. No disambiguation heuristic is needed.

Two independent axes, per token:

- **shape** (render): is the token entirely over the alphabet? → glyphs vs italic.
  VexFlow will render *any* such token as glyphs (`sfz`, `ff`, even nonsense) — shape
  does not require the token to be a *meaningful* dynamic.
- **meaning** (playback): is the token a *recognized* level? → contributes velocity,
  else ignored (carries the previous level, exactly like a text mark today).

A mark can therefore print something the engine does not play (`più f` prints both,
plays the `f`; `sfz` prints as glyphs, plays nothing until we map it — see Scope).

## Worked cases

| Typed        | Glyph runs | Italic runs | Plays |
|--------------|-----------|-------------|-------|
| `mp`         | `mp`      | —           | mp    |
| `mp`→del `m` | `p`       | —           | p     |
| `f con brio` | `f`       | `con brio`  | f     |
| `più f`      | `f`       | `più`       | f     |
| `sfz`→`f`    | `f`       | —           | f     |
| `sfz`        | `sfz`     | —           | (carries prev — not yet mapped) |
| `dolce`      | —         | `dolce`     | (carries prev) |

The parser scans the **whole** string for the recognized token — it may be a prefix
(`più f`), a suffix (`f con brio`), or the whole mark (`mp`). Position-agnostic.

## Scope

IN: the infrastructure — one editable string, parse-on-read, mixed-font rendering,
edit-any-dynamic. Recognized velocity set stays **today's `p / mp / mf / f`**.

OUT (later, its own decision): extending `DYNAMIC_VELOCITY` to the full ladder
(`ppp…fff`) — that forces re-spacing the 0..1 velocity curve because `f` is currently
at the `1.0` ceiling (no headroom for `ff`). Sforzando-type accents (`sf`, `sfz`,
`fp`, `rf`) render as glyphs but stay play-none for now (they're momentary attacks,
not steady levels — a separate per-note-accent feature). A mixed-font *edit overlay*
(the box edits in one font; the mix appears on commit — Sibelius does the same).

## Build order (test-driven — how we actually ship it)

Ship in the order that is TESTABLE, not the order of the logical decomposition. The
risky mixed-font rendering is deferred to the step that first needs it.

**Step 1 — edit an inserted dynamic's letters (NO mixed rendering).**
Insert `p`, double-click it → the edit box opens seeded with `p`. Change it (`p`→`f`,
`sfz`→`f`) or delete it to nothing (empty commit removes the mark). The result is
always a single dynamic glyph, so nothing renders mixed — zero rendering risk. This
is the first thing to hand-test. Covers: unlock the double-click on a level dynamic
(Phase 5), make a dynamic carry an editable string + parse it back to a level
(Phase 1 + Phase 2), seed the editor from the level letters.

**Step 2 — add text before AND after the letters.**
`sub. p`, `p dolce`, `f con brio`, `più f` → glyph run(s) + italic word(s) in one mark.
This is the FIRST step that renders mixed, so the rendering spike (Phase 0) lands
HERE, not before. If one Annotation can carry the mix, Step 2 is small; else it grows
the custom inline layout (Phase 3 fallback).

The phases below are the logical pieces; the two steps above pull from them in test order.

## Phases

### Phase 0 — Rendering spike (deferred to Step 2 — the only real unknown)

Everything else is mechanical. The mixed-font mark is the one thing that can't be
settled in jsdom (no font metrics — a hand-look spike).

Question: can **one** VexFlow `Annotation` render `f con brio` as upright-bold `f` +
italic `con brio`?

Hypothesis: annotation `fontStyle: italic`, family stack `Bravura, Georgia, serif`,
and substitute *only* the glyph-run characters with their SMuFL PUA codepoints (reuse
today's `DYNAMIC_LETTER_GLYPHS`). The PUA glyphs resolve to Bravura (upright, ignore
the italic); the ASCII words fall through to Georgia italic.

- PASS → Phase 3 is a small edit to `buildDynamicAnnotation`.
- FAIL (slant/spacing wrong) → Phase 3 grows a custom inline-layout modifier: measure
  each run, draw glyph-runs (music font) and italic-runs (serif) left-to-right, union
  the boxes. Bigger, but contained to `DynamicsLayout.ts`.

Decision point gates the Phase 3 estimate.

### Phase 1 — The parser (`utils/dynamics.ts`, pure, fully unit-testable)

- `splitDynamicRuns(text): { glyph: boolean, text: string }[]` — tokenize by
  whitespace; token entirely over `{f,p,m,s,z,r}` → `glyph:true`, else `glyph:false`.
  Preserves spacing so the renderer can reassemble the line. Drives BOTH render and
  interpretation.
- `parseDynamicText(text): { text: string, level?: DynamicLevel }` — level = the first
  glyph run that is a recognized level (a key of `DYNAMIC_VELOCITY`); absent if none.
  No `prev` argument (unlike tempo — a dynamic glyph is always printed, so there's no
  hidden state an edit could fail to "see").
- Rewrite the four semantic readers to derive from `text` via the parser instead of
  reading `d.level` — signatures unchanged, innards call the parser:
  `isInterpreted`, `dynamicLabel`, `resolveActiveLevel`, `resolveChordLevels`.

### Phase 2 — Model + serialization

- `types/music.ts`: drop `kind` and `level` from `Dynamic`; make `text` required.
  Update the doc comment (the three-axis note now reads: shape+meaning both derive
  from `text`).
- `clipboard.ts` (`level?` field) and `rebarOps.ts` (`level?` field): serialize `text`,
  drop `level`. Per the **no-JSON-migration** rule, the shape just changes — no
  migration path, keep toJSON/fromJSON aligned.

### Phase 3 — Rendering (`DynamicsLayout.ts`)

- `buildDynamicAnnotation`: replace the `isLevel ? glyphString : text` branch with the
  Phase-0 path (single glyph-substituted italic Annotation, or the custom inline layout).
- Bbox rebuild (currently gated on `dyn.kind === 'level'`, because glyph runs union a
  tall transparent pointer-rect and the box is rebuilt from the `<text>` baseline): new
  gate is **any mark containing a glyph run**. Verify whether pure-text marks can share
  the baseline rebuild (simpler) or must stay on the raw-group path.

### Phase 4 — Placement / arming (`PaletteController`, `MouseController`, `EditorState`)

- `DynamicTool = DynamicLevel | 'text'` **stays** — palette buttons are still
  `p/mp/mf/f/text`. Add `dynamicTextFromTool(tool)` (twin of `tempoFieldsFromTool`):
  `'text'` → `DEFAULT_DYNAMIC_TEXT` placeholder, else the letters (`'f'`).
- The four `addDynamic({kind, level|text, …})` call sites collapse to
  `addDynamic({ text, voice, placement, …staff })` — no more kind branch.
- Ghost preview builds from `dynamicTextFromTool` too, so ghost and placement agree
  (the bug the tempo comment calls out).

### Phase 5 — Unlock the editor (the feature)

- `MouseController.handleDynamicMouseDown`: delete the `if (dyn.kind === 'text')`
  guard on double-click — the editor opens on **every** dynamic.
  `DynamicTextSource.getText()` already seeds from `d.text`, now always present.
- `DynamicTextSource.getFontCSS`: overlay stays single-font (see OUT of scope). A `f`
  (30px Bravura) edited in a 14px italic box shifts slightly on open — accepted, as
  Sibelius does the same. Note as polish, don't build a mixed contenteditable.

### Phase 6 — Tests & docs

- New unit tests: `splitDynamicRuns` + `parseDynamicText` — the meat. Cover every row
  of the worked-cases table: `mp`, `mp`→`p`, `f con brio`, `più f` (prefix!), `sfz`→`f`,
  `sfz` (glyph, no level), `dolce` (italic, no level), empty.
- Update fixtures `{kind, level}` → `{text}` in: `dynamics`, `clipboard`,
  `PaletteController`, `MusicEngine`, `DynamicTextSource` tests.
- Break one green render assertion on purpose to confirm it CAN fail (jsdom is blind to
  fonts — a test that can't fail proves nothing).

## Risk read

- Low-risk / mechanical: Phases 1, 2, 4, 5, 6 — the parser is small; tempo is a working
  template for all of it.
- All real risk is Phase 0/3 (the mixed-font mark). If the font-stack trick renders, this
  is a small feature; if not, Phase 3 grows a custom inline layout. Hence Phase 0 is a
  spike with a decision point, not an assumption.

---

# What landed after this plan (2026-07-20)

The model above is unchanged — one char per letter, the FONT decides meaning, the level is always
derived. Three things were built around it.

## Entering dynamics: Ctrl+<letter>, the way Sibelius does

Inside the inline editor, `Ctrl+<letter>` types a letter in the DYNAMICS FONT rather than as text:
`f p m n r s` plus `z` on Ctrl+Shift+Z. Six come from VexFlow's `TextDynamics.GLYPHS`; `n` (niente,
U+E526) is the one entry we own, because VexFlow's table omits it and Bravura has the glyph.
`Ctrl+Shift+C`/`Ctrl+Shift+D` insert the WORDS `cresc.`/`dim.` — prose, never a level.

The binding is declared by the SOURCE (`EditableTextSource.getInsertions`), not the overlay, so it
belongs to the editor that defines it and exists nowhere else. An inserted glyph reuses the same chip
markup a seeded one gets, so a typed dynamic reads back identically to a loaded one.

⚠️ Two collisions, both resolved on the rule that **a shortcut must never mean two things**:
tempo moved Ctrl+M → **Alt+Shift+T** (lookup key `'Shift+Alt+t'` — `ShortcutManager` builds
Ctrl→Shift→Alt), and NOT to Ctrl+Shift+T, which Chrome RESERVES for "reopen closed tab" — reserved
shortcuts never reach the page, so `preventDefault` cannot help. `z` takes Ctrl+Shift+Z, matching
Sibelius, which dodges bare Ctrl+Z for the same reason we would (it is Undo while typing).

## Drawing them: precomposed glyphs (a draw-time ligature)

Bravura spaces each dynamics letter to stand ALONE and ships separate precomposed glyphs for the
combinations. For `p` the two agree (~347 combined vs 365 solo); for `f` they do not — precomposed
adds ~240 per extra `f` where concatenation adds 364, so a hand-built `fff` is 1092 units against the
real glyph's 831. That is a ~5px gap after every `f` at engraving size, which is exactly what showed
up in `sfz` and `fff` and never in `pp`.

This is an `fi` ligature, and the font would normally apply it — but the Bravura VexFlow bundles has
NO GSUB table (Bravura *Text* is the one with ligature features). So `composeDynamicGlyphs()`
substitutes by hand, greedy longest-match, at ONE call site in `enlargeDynamicGlyphRuns`.

**DRAW-TIME ONLY.** The model still stores one char per letter, so `parseDynamicText` is untouched
and the editor still backspaces a letter at a time. Storing precomposed would make one character mean
`"fff"` and break the glyph⇄letter axis outright.

⚠️ The codepoints are written out rather than read from VexFlow's `Glyphs` map: `Glyphs` is exported
by VexFlow's CJS build but NOT its ESM one, and the exports map sends bundlers to ESM — so a lookup
was populated under Vitest and EMPTY in the browser. The first cut shipped drawing loose glyphs with
a green test.

## Hearing them: the eight-level ladder

`DynamicLevel` is now `ppp pp p mp mf f ff fff`, with velocities

    ppp .05   pp .20   p .35   mp .47   mf .59   f .71   ff .85   fff 1.0

Started from the conventional MIDI ladder (Finale/Sibelius defaults) but is deliberately NOT it: the
gaps WIDEN toward the extremes (`pp`→`p` is .15 against `p`→`mp` at .12). Even velocity steps do not
read as even loudness steps, and the outer marks should land as events while `p`..`f` is the ordinary
working range. Flat spacing made `pp`/`ppp` hard to tell from `p`.

⚠️ **`f` is 0.71 and must stay ≤ 0.77.** `playbackSchedule` does `Math.min(1, velocity * articulation)`
and accent is ×1.3 — while `f` sat at 1.0, an accent on a forte note was arithmetically INAUDIBLE.
Only `fff` may reach the ceiling. Known and accepted: accents clamp at `ff`/`fff`, which is
unavoidable geometry (`fff` cannot both be full volume and leave room above it).

⛔ **`sf` / `sfz` / `fp` / `rf` are NOT levels and must never get a velocity row.** A level is a
SUSTAINED state governing every note until the next mark; those are momentary — an accent on one
note, or loud-then-immediately-soft. A row would mean "everything from here on is sfz-loud". They
engrave correctly and stay silent, carrying the previous level forward, which is the right fallback
until accents get their own mechanism. **That is the next piece of work.**

⚠️ `parseDynamicText` matches a run's WHOLE letters, so adding `ff` must not make `sffz`/`fz`
interpretable — re-check that on every table change; a test guards it.

## The Vue dynamics palette is gone

Deleted (33 lines from `App.vue`). It hardcoded four of the eight levels, so it could not reach
`pp`/`ppp`/`ff`/`fff` and presented `f` as the top of the range — a UI that misrepresents the model,
which is worse than no UI. Its `Text` button was Ctrl+E exactly.

`PaletteController.setDynamic` is KEPT with no caller but its tests: it is the tested half
(arming, disarm-on-re-press, replacement, mutual exclusion, place-on-selection), it is not
Vue-shaped, and it is the seam a Keypad dynamics page will call. A future palette must derive its
rows from `DYNAMIC_VELOCITY` — the hardcoded list is exactly what made the old one wrong.
