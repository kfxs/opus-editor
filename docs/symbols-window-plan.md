# The Symbols window

A browsable chart of every SMuFL glyph — Sibelius's `Z` dialog, MuseScore's Master Palette ▸
Symbols, and the SMuFL spec's own glyph tables, in one window.

**Decided: it is Sibelius-shaped, and it opens on `z`.** One continuous scrolling panel with the
category beside each block — not MuseScore's one-range-at-a-time dialog. The other two references
contribute one part each and nothing more: MuseScore the search box, the spec tables the per-glyph
detail.

**It does NOT put anything on the score.** Not in this plan, not behind a flag. It is a *reference*:
you look a glyph up, you read its name and codepoint, you copy that string out. Insertion is a
different feature with a different model (a symbol attached to a note or a system, engraved and
positioned) and inventing half of it here would be inventing the wrong half.

Two audiences, one window:

- **the musician** — "what is the sign for a bracketed accidental, and does our font have it?"
- **the developer** (us) — "give me the literal for that glyph so I can paste it into a source
  file, or into a message to Claude." Today `tempoMenu.ts` and `TempoLayout.ts` carry hand-written
  `'\uECB7' // metAugmentationDot` comments, verified by eye against a website. This window is that
  lookup, in the app.

## What the three references actually do

| | Sibelius (`Z`) | MuseScore (Master Palette ▸ Symbols) | SMuFL glyph tables |
|---|---|---|---|
| Shape | one scrolling panel, symbols in rows, category name beside each row | one range at a time, chosen from a list; a grid of cells | a web page per range, 131 ranges |
| Search | gallery category filter at the top (reads "All" until set) | a search box filtering by the glyph's *user* name, case-insensitive | browser find |
| Font | its own symbol set | a font menu bottom-right: Bravura / Leland / Emmentaler / Gonville | Bravura, always |
| Per glyph | the glyph; a name on hover | the glyph + its user name | **codepoint, canonical name, description, rendered glyph** |
| Bottom bar | Size (normal/grace/cue), Create Symbol, Edit Symbol | font menu | — |

We take **Sibelius's silhouette**, **MuseScore's search**, and **the spec tables' per-glyph
detail** — which is the part neither editor shows and the part a developer actually needs.

Two things the references have that we deliberately will not:

- **No font menu.** We ship one music font. Bravura is SMuFL's *reference* font and contains
  essentially every glyph in the specification, so "all of SMuFL" and "all of Bravura" are the same
  list for us. (A glyph the font is missing draws as a blank cell — detectable later by measuring
  advance width, not worth doing until one shows up.)
- **No Size / Create / Delete.** Those exist to serve insertion.

## The look

```
┌─ Symbols ─────────────────────────────────────────────────────────── ✕ ─┐
│ Search: [ notehead                 ]              showing 34 of 2932     │
├──────────────────┬──────────────────────────────────┬───────────────────┤
│ Staff brackets   │  NOTEHEADS                       │        ●          │
│ Barlines         │   ┌────┬────┬────┬────┬────┐     │                   │
│ Clefs            │   │ 𝅝  │ 𝅗𝅥  │ ●  │ ○  │ ◆  │     │ noteheadBlack     │
│ Noteheads     ◀  │   └────┴────┴────┴────┴────┘     │ Black notehead    │
│ Slash noteheads  │                                  │                   │
│ Round/square…    │  SLASH NOTEHEADS                 │ U+E0A4            │
│ Individual notes │   ┌────┬────┬────┐               │ Noteheads ·       │
│ Beamed groups    │   │ …  │ …  │ …  │               │   U+E0A0–U+E0FF   │
│ Stems            │   └────┴────┴────┘               │ Classes: noteheads│
│ …131 ranges…     │                                  │                   │
│                  │                                  │ Copy:             │
│                  │                                  │ [ noteheadBlack ] │
│                  │                                  │ [ U+E0A4 ]        │
│                  │                                  │ [ '\uE0A4' ]      │
│                  │                                  │ [ ● ] [ all ]     │
└──────────────────┴──────────────────────────────────┴───────────────────┘
```

- **Left — the ranges.** All 131, scrolling. Clicking one scrolls the grid to that block; it is
  navigation, not a mode. (MuseScore makes it a mode — one range at a time — which is why you
  cannot scroll from noteheads into slash noteheads there.)
- **Centre — one continuous grid**, in SMuFL's own order, with a category header over each block.
  This is the Sibelius panel.
- **Search** filters the whole grid at once — by canonical name, by description, or by a codepoint
  typed as `E0A4`, `U+E0A4` or `\uE0A4`. That last form is the developer's entry point: you have a
  literal in the source and want to see what it draws.
- **Right — the detail column.** The glyph large, its canonical name, its description, its
  codepoint, its range, its classes, its standard-Unicode equivalent, and the copy chips.

## What we add that Sibelius doesn't — and where it is allowed to go

Sibelius's panel shows the glyph and nothing else. That is right for picking a sign and useless for
the second audience, so we add information — under one rule that keeps the style intact:

> **The grid stays a wall of glyphs.** Nothing is added to a cell: no codepoint under it, no name
> label, no badge. Every extra fact lives in the window's chrome — the strip above, or the detail
> panel — or on hover. That chrome is the whole budget.

**Where the detail panel went.** It began as a bottom BAR, which is where Sibelius keeps this kind
of chrome (its Size and Create Symbol sit there). Built, it reads better as a **column on the
right**: the facts are a list of short lines and the chips a stack of strings, both of which read
down rather than across, and a bar deep enough to hold them takes the depth out of the chart —
where the wall of glyphs is the whole point. The window is three columns now: ranges, chart,
detail. The rule above is untouched either way; it is about CELLS, not about which edge the chrome
sits on.

| what | where | why it earns the space |
|---|---|---|
| canonical name + `U+E0A4` | hover tooltip | Sibelius already names a symbol on hover; this is that, with the codepoint |
| description | detail column | the spec's own prose — "black notehead" beats guessing from a picture |
| range + its codepoint span | detail column | tells you *where you are*, which a filtered grid otherwise hides |
| **SMuFL classes** (`classes.json`) | detail column | the cross-cutting membership neither editor shows: this glyph is in `noteheads`, `articulationsAbove`, `combiningStaffPositions`. A range says where it is printed; a class says what it *is* |
| **the standard-Unicode codepoint** (`alternateCodepoint`, on 222 glyphs) | detail column, and a copy chip | ⚠️ CORRECTED: this is **not** a stylistic variant. It is the same sign's home in Unicode's musical-symbols block — `accidentalFlat` is U+266D (♭) as well as U+E260 — and that is the one form that survives outside a music font. Stylistic variants (small, text, turned) live in Bravura's *optional glyphs*, which are in `bravura_metadata.json` and are not loaded |
| ~~VexFlow's name for it~~ | — | ⛔ DROPPED. `Glyphs` is absent from VexFlow's ESM entry (0 occurrences in `build/esm/entry/vexflow.js`) and the package's `exports` map blocks deep-importing it, so the question cannot be answered honestly at runtime — see `reference_vexflow_glyphs_esm_vs_cjs`. A guessed answer here would be believed |
| `showing N of M` | top bar, beside the search | a filtered grid must never quietly read as the whole set |
| the copy chips | detail column | below |

Deliberately still out: anything per-cell, and any second font.

### Copy

The whole point is that the string leaves the app, so *what* gets copied is the choice, not an
afterthought. A row of labelled chips rather than one Copy button with a hidden meaning — each chip
shows the exact string it puts on the clipboard:

| chip | clipboard |
|---|---|
| `noteheadBlack` | the canonical name |
| `U+E0A4` | the codepoint, spec-style |
| `'\uE0A4'` | the TypeScript literal, ready to paste into source |
| `●` | the character itself |
| `all` | `noteheadBlack U+E0A4 ● — Black notehead` (the line to paste into a message) |

Every chip copies **plain text**, so it lands anywhere: a source file, the devtools console, a
commit message, a message to Claude. The escaped form is the one that survives all four — pasted
into the console it evaluates to the glyph, pasted into a `.ts` file it compiles, and unlike the
bare character it stays visible in a diff and in a terminal that has no music font. Copying the
character itself is the other chip precisely because sometimes you *do* want the invisible one.

`navigator.clipboard.writeText` needs a user gesture (a click, which this is) and a secure context —
`localhost` counts, so dev is fine. A chip confirms by changing its own label to "copied" for a
second: a copy that silently fails is worse than no button, and there is no other feedback.

## The data

`glyphnames.json` and `ranges.json` from the SMuFL distribution, vendored under
`public/smufl/` with their licence, and **fetched on first open** — never bundled.
`engine/export/exportFonts.ts` already does exactly this for `public/fonts/*.otf`: a module-level
promise, fetched once, cached. ~600 KB that costs the editor's startup nothing.

- `glyphnames.json` → name, codepoint, description, alternates.
- `ranges.json` → the 131 ranges, their titles and their glyph lists. **This file is the left
  column and the block headers**; without it we would be inventing categories out of name
  prefixes, which SMuFL names do not support.
- `classes.json` → the cross-cutting sets (`noteheads`, `articulationsAbove`, …). Small, and the
  only source for the class line in the detail bar. A glyph is in one range and in any number of
  classes — do not collapse the two.

VexFlow's `Glyphs` enum (2933 entries, `vexflow/build/esm/src/glyphs.js`) is *not* the source — it
has no descriptions and no grouping. It becomes one line in the detail bar: whether VexFlow has a
name for this glyph. ⚠️ `reference_vexflow_glyphs_esm_vs_cjs` says importing that enum has bitten us
before; if the deep import misbehaves, drop the line rather than fight it.

`bravura_metadata.json` (bounding boxes, anchors, optional ligatures) is the obvious next detail
source. Not now.

## The parts

```
src/windows/symbols/
  index.ts          # installSymbols(windows) — registers the toggle, opens the window
  SymbolsWidget.ts  # the three panes; owns selection + search state
  glyphGrid.ts      # the scrolling grid: blocks, cells, lazy fill
  smufl.ts          # fetch + cache + index (by name, by description, by codepoint)
  copyChips.ts      # the detail bar's clipboard row
```

Same shape as `windows/keypad/` and `windows/properties/`: a folder with an `install…()` that
`windows/index.ts` calls, so `App.ts` never learns this exists (docs/windows-design.md).

Window options: `resizable: true`, `center: true`, `onCancel: close`, no `fitContent` (it is a
browser — it wants a size, not its content's size).

**Not new entries in `widgets.ts`.** `Widget.ts` says the toolkit stays tiny and anything genuinely
complicated gets its own module. A lazily-filled 3300-cell grid is that.

Shortcut: **`z`** — Sibelius's key, and free in `ShortcutConfig.ts` (`s`, `x`, `t`, `q`, `n`, `a`–`g`
are taken; `z` is not).

## Traps

- **Cells are SVG, not HTML spans.** `reference_smufl_glyph_needs_svg_box`: an HTML line box clips a
  note's stem. `widgets.ts` already has the shape — `glyphSvg()`, with
  `baseline = (H − GLYPH_PX)/2 + 0.875 × GLYPH_PX`. The grid needs its own copy sized for a cell,
  not a row.
- **Some SMuFL glyphs are enormous** — staff brackets, octave lines, multi-bar rests — and will
  burst a uniform cell. Either accept the overflow (`overflow: visible`, they bleed into the gaps)
  or scale each cell from `getBBox()`. Start with the first; the second is a P2 if it looks bad.
- **Don't build 3300 cells at once.** Each block reserves its height up front
  (`ceil(n / cols) × cellH`) and fills its cells when it scrolls near — one IntersectionObserver,
  released in `destroy()`. This is what buys the continuous Sibelius scroll instead of MuseScore's
  one-range-at-a-time.
- **Fonts before measuring.** `document.fonts.ready` — `export/scoreSvg.ts` learned this already.
- **`Ctrl+C` is the score's clipboard** in `ShortcutConfig.ts`. The window must own the key while
  focused, or we stay on the chips. (The `Window` layer already has `dataset.ownsKeys` for this.)
- **`z` must not fire while a text field has focus** — the search box is inside the window.
- Search over 3300 × (name + description) on every keystroke is fine as a plain scan; do not build
  an index until it measures slow.

## Phases

**P0 — the shell.** Window, `z`, three panes, the range list from `ranges.json`, the grid drawing
real glyphs, the block headers. No search, no detail bar. The point is to *look at it* and argue
with the picture before wiring anything.

**P1 — search.** Name, description, codepoint forms; the "showing N of M" line, so a filtered view
never quietly pretends to be everything.

**P2 — the detail bar + copy chips.** The dev tool proper: name, codepoint, description, range,
classes, alternates, VexFlow's name. Hover tooltips land here too.

**P3 — polish, only if P0 says so.** Scale-to-fit cells, keyboard navigation of the grid
(arrows + Enter), remembering the last range across opens.

**Later, if it proves itself.** Two ideas that are real information but not obviously worth their
cost: the glyph drawn **on a staff** at true staff-space scale, so its size is legible and not just
its shape; and **"used in our source"** — a build-time index of which codepoints already appear in
`src/`, so the detail bar can say *`TempoLayout.ts` already draws this one*. Both are additions to
the detail column, so neither disturbs the style. Neither is in scope until someone wants it twice.

## Open

- Whether the left column should be all 131 SMuFL ranges or a shorter musician-facing grouping
  (Sibelius's categories are far coarser). Start with all 131 — it is the honest structure, and
  P0 will show whether it is unusable.
- Insertion. Explicitly out of scope; when it arrives it brings a `Symbol` model, an anchor, and an
  engraving position with it, and this window grows one callback.
