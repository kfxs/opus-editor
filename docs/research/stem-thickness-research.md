# THE STEM'S THICKNESS — the sourced options, as future HOUSE-STYLE PRESETS

> 📄 Research, **2026-09-14**. ⛔ **This document recommends nothing and changes no code.** The
> number is one row of a future user-selectable house style; this is the shelf it will be picked
> from (§5).
>
> ⭐ Sibling of `docs/research/stem-length-research.md` (which did the TREATISES, §1 *THICKNESS* and §3.4) and
> `docs/research/staff-line-research.md` (the staff line, §5, which every ratio below divides by).
>
> **Headlines.**
> 1. ⛔ **No book gives a number.** Three say *thinner than the staff line*; ⭐ **Ross p. 151 adds one
>    thing nobody here had quoted**: the order is a matter of period. Before offset printing,
>    *"staff lines were thin, stems thicker"*.
> 2. ⭐ **Gould's plates, measured on three pages, put the stem at ≈1.0× her staff line**: 0.90–1.03×
>    on p. 490 (≈70 beamed stems) and ≈1.0× on p. 14. 🚨 On p. 125 the stems measure 1.0–1.3×, and
>    **her grace-note stems are no thinner than her full-size stems**.
> 3. The implementations span **0.075 → 0.20 sp**, and as ratios **0.61× → 2.0×**. The engines split
>    on the direction: MuseScore and the SMuFL "text" faces draw the stem thinner than the staff
>    line; LilyPond (1.3×), Verovio (1.33×), VexFlow (1.5×) and **we (1.36× today)** draw it thicker.
> 4. **Scaling is the other axis, and nobody agrees.** MuseScore scales the stem with the staff
>    *and* with grace/cue size. Verovio scales it with the staff only. LilyPond scales it with
>    neither: it follows the staff *line*, and `\magnifyMusic` may not thin it. VexFlow keeps a
>    fixed pixel width.

---

## 0. The question

1. **How thick is a stem**, in staff spaces?
2. **As a ratio to the same source's staff line.** The repo prefers the ratio, because the staff
   line is itself a setting (`staff-line-research.md` §8, decided 0.11 sp *as a default*).
3. **Does it scale** with staff size, and with **grace / cue** size?
4. **Is a BEAMED note's stem the same thickness** as an unbeamed one?

## 1. Sources, and how to reach them again

| source | where | what answers |
|---|---|---|
| Gould, *Behind Bars* | `reference/…(Elaine Gould)….pdf`, **PDF = printed + 20** | p. 13 (PDF 33) prose · p. 14 (PDF 34) plate · **p. 125 (PDF 145)** grace figure · **p. 490 (PDF 510)** engraved 32nds · p. 569 (PDF 589) cue prose |
| Ross, *Art of Music Engraving* | `reference/…(ted ross)….pdf`, **PDF = printed + 12** | **p. 82 (PDF 94)** prose + BAD/GOOD figure · **p. 151 (PDF 163)** the period remark |
| Gerou & Lusk; Stone | `reference/` | as `stem-length-research.md` §1; nothing new |
| LilyPond `master@beedbfa` | `~/dev/engine-sources/lilypond` | `scm/define-grobs.scm`, `lily/stem.cc`, `lily/staff-symbol-referencer.cc`, `scm/music-functions.scm`, `ly/engraver-init.ly`, `ly/music-functions-init.ly` |
| MuseScore `main@929d1e9` | `~/dev/engine-sources/MuseScore` | `src/engraving/style/styledef.cpp`, `dom/stem.cpp`, `dom/chord.cpp`, `rendering/score/tlayout.cpp`, `tdraw.cpp` |
| Verovio `develop@efff0bc` | `~/dev/engine-sources/verovio` | `src/options.cpp`, `src/doc.cpp`, `src/view_element.cpp` |
| musxdom `@c870522` (Finale) | `~/dev/engine-sources/musxdom` | `src/musx/dom/Options.h`, `Fundamentals.h`, `tests/data/reference/*Default*.enigmaxml` |
| VexFlow 5.0.0 | `node_modules/vexflow/build/esm/src/` (⚠️ removed from the app 2026-09-19; same build at `~/dev/engine-sources/vexflow-5.0.0-npm/package/build/esm/src/`) | `tables.js`, `stem.js`, `beam.js` |
| SMuFL metadata | `scripts/vendor/Bravura.json`; `verovio/fonts/*/`; `MuseScore/fonts/*/`; `musxdom/tests/data/font_metadata/` | `engravingDefaults.stemThickness` |

**Plate method** (new here). Pages rendered with `pdftoppm -r 450` (1 sp ≈ 20 px on Gould), measured
with PIL; the script is in `/tmp/claude-1000/stem-thickness-research/measure.py`, which is not kept.
- Staff lines come from a row profile. A line's thickness is the 30th percentile, over columns, of
  its vertical ink integral. The ink integral is `Σ (paper − v)/(paper − black)`.
- A stem is a vertical dark run ≥ 1.5–2 sp long and < 0.35 sp wide. Its width is the median
  horizontal ink integral over rows that lie ≥ 0.6 sp from both ends, away from staff lines, and
  with blank paper on both sides.
- Barlines come out at 0.174–0.179 sp on p. 490, which is a sanity check.
- ⚠️ `staff-line-research.md` §3 found this family of method reads ≈ +5 % high. The **ratio** is
  taken on the same page with the same calibration, so it is the robust number.

## 2. The books

**Already done — see `docs/research/stem-length-research.md` §1 (*THICKNESS*), §3.4, §5.4, §6.1.**
- **Gould p. 13:** *"thinner than the stave-line"*.
- **Ross:** *"somewhat thinner than the staff line"*.
- **Gerou & Lusk pp. 25/137:** *"thinner than staff lines"*.
- **Stone:** UNKNOWN.
- **Gould's p. 14 plate:** stem 0.106–0.120 sp vs staff line 0.107–0.116 sp, i.e. the same.

⚠️ **Correction of a page number.** The Ross sentence is on **printed p. 82** (PDF 94, the page
numbered "82", *Chapter 3 · Section 1: STEMS*), not p. 83. The scan shows it.

### 2.1 ⭐ New: Ross p. 151 — the order is a matter of PERIOD, not a law

From the scan, *Barlines*:

> *"the recent advent of offset printing has caused changes in barline thickness (prior to offset
> printing, staff lines were thin, stems thicker, and barlines thickest; today, although engravers
> differ on this point, the tendency is to have barlines thick, staff lines thinner, and stems
> thinnest)."*

⇒ Ross himself calls *stem < staff line* a **tendency** that *"engravers differ on"*. He also
records that plate-era engraving (pre-offset) had the opposite, **stem > staff line**. ⭐ That makes
LilyPond's 1.3× a historically sourced style, not merely a deviation (§3.1 gives LilyPond's own
motive). ⛔ He gives no number for either period.

### 2.2 ⭐ New: Ross p. 82's BAD/GOOD figure, measured — ⚠️ weak

Ross's figure is two half notes on one small staff (PDF 94, 450 dpi, sp = 25.25 px, grey paper
189 / ink 41).

| | width | in sp | ratio to that staff line (4.24 px = 0.168 sp) |
|---|---|---|---|
| **BAD** stem | 6.02 px | 0.238 | **1.42×** |
| **GOOD** stem | 2.60 px | 0.103 | **0.61×** |

⚠️ This is a **demonstration drawing** in a photo-offset reproduction that visibly breaks the GOOD
stem into dashes. The staff line reads 0.168 sp here against 0.081 on his p. 79 specimen
(`staff-line-research.md` §3.4). ⛔ Do not quote either absolute value. What survives is the
**direction** (good < line < bad) and an order of magnitude for "somewhat thinner": about 0.6×.

### 2.3 ⭐ New: Gould p. 490 (PDF 510) — ≈70 BEAMED stems on real engraved music

Two systems of beamed 16ths/32nds. Features 2.2–2.8 sp long were excluded as accidentals.

| | stems | staff line | ratio |
|---|---|---|---|
| system 1 (sp 20.0 px), 42 stems | **0.105–0.119 sp** | 0.116 sp | **0.90–1.02×** |
| system 2 (sp 20.5 px), ~30 stems | **0.104–0.116 sp** | 0.112 sp | **0.93–1.03×** |
| barlines, same page | 0.174–0.179 sp | | 1.54–1.58× |

⭐ **Her beamed stems are her staff-line weight, ±10 %.** The widths cluster in two bands (≈0.105
and ≈0.116 sp), which is pixel phase, not two stem weights. This agrees with p. 14's unbeamed
stems. ⇒ On her plates **a beamed stem is not a different thickness**.

### 2.4 ⭐ New: Gould p. 125 (PDF 145) — the grace-note figure, and it does NOT thin the small stems

The *Grace notes / Appoggiaturas* figure (staff line 0.117 sp; paper 255 / ink 28). Stems were
classified by eye on a 2× crop.

| | stems (sp) | ratio to staff line |
|---|---|---|
| full-size stems (6) | 0.119, 0.127, 0.131, 0.141, 0.142, 0.144 | **1.02–1.23×** |
| grace + appoggiatura stems (6) | 0.116, 0.142, 0.143, 0.143, 0.150, 0.151 | **0.99–1.29×** |

⚠️ Few rows per stem (these stems are 2.4–3.7 sp long), and several small stems carry a slash, so the
error is larger than p. 490's. Still, two readings survive:
- **(a)** her small-note stems are **not visibly thinner** than her full-size stems in the same figure;
- **(b)** this figure's stems sit *above* its staff line, the opposite side from p. 490.

⇒ Across Gould's three pages the ratio is **≈1.0×, range 0.9–1.3×**, and never the *"thinner"* of
her p. 13.

**Gould's prose on small notes** (scans):
- p. 125: grace notes have *"stems shortened to about 2¼ stave-spaces. **Tails, beams, articulation
  and accidentals** are also scaled down proportionally"*. Stems' **thickness** is not in the list.
- p. 569, cue notation: *"All notation symbols that are part of the cue … are scaled down"*. Ledger
  lines are *"thinner"*.

⛔ **Stem thickness for grace/cue notes: no sentence in Gould.** The plate (a) is the only evidence.

## 3. Engines and fonts

### 3.1 The engines

| engine | stem | staff line | **ratio** | scales with STAFF size? | with GRACE / CUE? | beamed stem |
|---|---|---|---|---|---|---|
| **LilyPond** | `Stem.thickness 1.3` (`scm/define-grobs.scm:3475`) **× the staff's line-thickness** (`lily/stem.cc:909-912`, which reads `Staff_symbol_referencer::line_thickness`, `lily/staff-symbol-referencer.cc:56-62`) ⇒ **0.13 sp** at the default 20 pt | 0.10 sp (`scm/paper.scm:52-66`, per `staff-line-research.md` §5.2) | **1.30×, by construction** | ⚠️ it follows the staff LINE, which is affine in points, not proportional (`staff-line-research.md` §5.3). Relative weight grows as the staff shrinks: 10 pt ⇒ ≈0.22 sp | ⛔ **no.** Grace sets `Stem font-size -3` and `length-fraction 0.8` but not `thickness` (`scm/music-functions.scm:674-688`); `CueVoice` sets `fontSize -4` and length/beam only (`ly/engraver-init.ly:432-437`). Thickness multiplies the *staff's* line, so a grace stem has the full-size weight. `\magnifyMusic` lists `(Stem thickness)` as **unshrinkable** (`ly/music-functions-init.ly:1062-1065, 1113`) | same grob, same `thickness`; drawn as `round_filled_box` of width `thickness` (`lily/stem.cc:1038-1044`) |
| **MuseScore** | `Sid::stemWidth 0.10_sp` (`src/engraving/style/styledef.cpp:257`) | `Sid::staffLineWidth 0.11_sp` (`styledef.cpp:277`) | **0.91×** | ✅ yes: pen `= styleAbsolute(stemWidth) × item->mag()` (`rendering/score/tdraw.cpp:2602`); the stem's mag is the chord's (`tlayout.cpp:5344`), = `staffMag × intrinsicMag` (`dom/chord.cpp:2083-2087`), `smallStaffMag 0.7` (`styledef.cpp:520`) | ✅ **yes:** `intrinsicMag` × `graceNoteMag 0.7` / `smallNoteMag 0.7` (`dom/chord.cpp:2063-2078`; `styledef.cpp:515, 517`) ⇒ a grace stem is **0.07 sp** on a normal staff, **0.64×** that staff's line | same `Stem`, same width (`dom/stem.cpp:69-71`) |
| **Verovio** | `m_stemWidth 0.20` MEI units = **0.10 sp** (`src/options.cpp:1532-1534`; `doc.cpp:2062-2065`) | 0.15 units = 0.075 sp stated, 0.0722 drawn (`options.cpp:1528-1530`; `staff-line-research.md` §5.2) | **1.33×** (1.38× as drawn) | ✅ yes: `× GetDrawingUnit(staffSize)` (`doc.cpp:2064`) | ⛔ **no:** `DrawStem` passes only `staff->m_drawingStaffSize` (`src/view_element.cpp:1780-1781`), no cue factor, while dots and flags do take one (`view_element.cpp:682, 952`) | same `DrawStem` |
| **Verovio + font** | ⚠️ `stemThickness` → `m_stemWidth` (`options.cpp:2103`), **opt-in only** (`options.cpp:2091`) | | | | | |
| **VexFlow 5** | `Tables.STEM_WIDTH = 1.5` px (`tables.js:595`), stroked `ctx.setLineWidth(Stem.WIDTH)` (`stem.js:125`) ⇒ 0.15 sp at 10 px/sp | 1 px (`staff-line-research.md` §5.2) | **1.50×** | ⛔ fixed pixels: a change of `spacing_between_lines_px` leaves it 1.5 px | ⛔ no: `GraceNote` reuses `Stem`, `Stem.WIDTH` is a static | same `Stem`; the beam offsets by `Stem.WIDTH / 2` (`beam.js:515`) |
| **Finale** (musxdom) | `StemOptions::stemWidth`, in **Efix** (`src/musx/dom/Options.h:1454`; 1 sp = 24 EVPU × 64 = 1536 Efix, `Fundamentals.h:62, 89, 92`). ⛔ **No default in the model**: the field is value-initialised `{}` | `staffLineWidth`, Efix (`Options.h:577`) | see below | UNKNOWN | UNKNOWN | UNKNOWN |

**Finale's document values, as found in musxdom's test fixtures** (`tests/data/reference/`).
⚠️ Named after Finale's default files, but ⛔ **their provenance is not documented in the repo**, so
"factory default" is not established. They were read, not inferred:

| fixture | `stemWidth` (Efix → sp) | `staffLineWidth` (Efix → sp) | ratio |
|---|---|---|---|
| `MaestroFontDefaultWin` / `FinaleMaestroFontDefaultMac` (`:1242` / `:1241`) | 140 → **0.091** | 140 → 0.091 | **1.00×** |
| `PattersonDefault` (`:1224`) | 128 → 0.083 | 128 → 0.083 | 1.00× |
| `Handwritten Default` (`:1244`) | 224 → 0.146 | 224 → 0.146 | 1.00× |
| `Finale Broadway Font Default` (`:1229`) | 230 → 0.150 | 230 → 0.150 | 1.00× |
| `Jazz Font Default` (`:1239`) | 147 → 0.096 | 224 → 0.146 | 0.66× |
| `Finale Jazz Font Default` (`:1204`) | 256 → 0.167 | 160 → 0.104 | 1.60× |

Also: **87 of the 107 enigmaxml fixtures** under `tests/data/` carry `115/115` Efix (0.075 sp, 1.00×).
Every fixture except the two Jazz defaults pairs the stem with the staff line **equally**.
⭐ Maestro's 0.091 is exactly the **Finale Maestro** font's own `stemThickness` (below).

### 3.2 SMuFL fonts — `engravingDefaults.stemThickness`, every metadata file on disk

| font (version) | `stemThickness` | `staffLineThickness` | **ratio** | file:line |
|---|---|---|---|---|
| **Bravura** 1.481 (vendored) | **0.12** | 0.13 | **0.92×** | `scripts/vendor/Bravura.json:23, 22` |
| Bravura 1.392 | 0.12 | 0.13 | 0.92× | `verovio/fonts/Bravura/bravura_metadata.json:25, 24`; same in `MuseScore/fonts/bravura/` |
| **Leland** 0.80 | **0.10** | 0.11 | **0.91×** | `verovio/fonts/Leland/leland_metadata.json:23, 22`; same in MuseScore |
| **Petaluma** 1.065 | 0.12 | 0.13 | 0.92× | `MuseScore/fonts/petaluma/petaluma_metadata.json:22, 21` |
| ⚠️ **Petaluma** 1.04 | **0.20** | 0.13 | **1.54×** | `verovio/fonts/Petaluma/petaluma_metadata.json:22, 21`. The same font disagrees with itself across versions |
| **Gootville** 1.3 | 0.12 | 0.13 | 0.92× | `verovio/fonts/Gootville/gootville_metadata.json:24, 23` |
| **Leipzig** 5.2.101 (Verovio's default) | **0.076** | 0.08 | **0.95×** | `verovio/fonts/Leipzig/leipzig_metadata.json:23, 22` |
| **Emmentaler** 2.003 (MuseScore's) | **0.13** | 0.08 | **1.63×** | `MuseScore/fonts/mscore/metadata.json:22, 21` |
| **MuseJazz** 1.0 | **0.20** | 0.10 | **2.00×** | `MuseScore/fonts/musejazz/metadata.json:22, 21` |
| **Finale Maestro** | **0.091** | 0.091 | **1.00×** | `musxdom/tests/data/font_metadata/Finale Maestro/Finale Maestro.json:22, 21` |

⭐ The engraved-look faces (Bravura, Leland, Gootville, Leipzig) all sit at **0.91–0.95×**, which is
the treatises' sentence. The handwritten/jazz faces go **above** the line (1.5–2×). ⚠️ SMuFL itself
publishes no default (`staff-line-research.md` §5.1), so every row is one font's house value.

## 4. What this repo draws today

- **Ink:** `drawStem(ctx, stem, thickness)` strokes one line (`src/engine/engrave/notes/stem.ts:65-71`).
  Every caller passes VexFlow's **`Stem.WIDTH` = 1.5 px = 0.15 sp** — ⭐ since S1b (2026-09-14) as the
  attributed row `STEM_THICKNESS_PX` in `src/engine/engrave/inheritedDefaults.ts`, same value:
  - `EngravedStem.draw` (`src/engine/rendering/EngravedNote.ts:96-100`);
  - both `FanPass` stems (`src/engine/rendering/FanPass.ts:477-481, 581`).
  The module's header already names this a two-source question (`stem.ts:37-43`).
- **Room:** the ink table's arithmetic spends **Bravura's `stemThickness` 0.12**
  (`src/engine/fonts/bravuraMetrics.ts:360`; `fontMetrics.ts:249, 277`). ⚠️ So the room reserved and
  the ink drawn already come from two different sources.
- **The staff line it is measured against** is now **0.11 sp** (`src/engine/engrave/staff/staffLines.ts:179`,
  HIS 2026-09-01 decision). ⚠️ The earlier `staff-line-research.md` §4.1 quotes the old 1 px.
  ⇒ **today's ratio is 0.15 / 0.11 = 1.36×**: thicker than the staff line, the LilyPond/Verovio/VexFlow
  side.
- **Scaling:** ✅ with staff size, because a staff's glyphs are painted inside `<g transform="scale(k)">`
  (`src/engine/rendering/staffScaleGroup.ts:10`), which scales the stroke. Grace/cue: **n/a**, since
  the engine has no grace notes. Beamed and unbeamed stems: **the same** width (one `Stem.WIDTH`).

## 5. ⭐ PRESET ROWS

One row per source. "Ratio" is to **that source's own** staff line. A ratio preset multiplies
*our* staff-line setting; an absolute one ignores it.

| # | preset | stem (sp) | ratio | scales with staff | with grace/cue | citation |
|---|---|---|---|---|---|---|
| 1 | **Gould — engraved plates** | ≈0.11 (0.104–0.120) | **≈1.0×** (0.90–1.03 beamed; p. 125: 1.0–1.3) | — (her staff line does, `staff-line-research.md` §3.2) | not thinner on her p. 125 plate | Gould pp. 14, 125, 490, measured (§2.3–2.4; `stem-length-research.md` §3.4) |
| 2 | **Gould / Ross / G&L — prose** | ⛔ none | **< 1×** (*"thinner"*, *"somewhat thinner"*) | — | — | Gould p. 13; Ross p. 82; G&L pp. 25, 137 |
| 3 | **Ross — BAD/GOOD figure** (weak) | ⛔ not quotable | ≈0.6× | — | — | Ross p. 82 figure, measured (§2.2) |
| 4 | **Ross — plate era** | ⛔ none | **> 1×** (*"staff lines were thin, stems thicker"*) | — | — | Ross p. 151 |
| 5 | **Bravura** | 0.12 | **0.92×** | (font units ⇒ proportional) | — | `scripts/vendor/Bravura.json:23` |
| 6 | **Leland** | 0.10 | **0.91×** | | | `leland_metadata.json:23` |
| 7 | **Petaluma** 1.065 / 1.04 | 0.12 / 0.20 | 0.92× / 1.54× | | | `MuseScore/…/petaluma_metadata.json:22`; `verovio/…/petaluma_metadata.json:22` |
| 8 | **Gootville** | 0.12 | 0.92× | | | `gootville_metadata.json:24` |
| 9 | **Leipzig** | 0.076 | 0.95× | | | `leipzig_metadata.json:23` |
| 10 | **Emmentaler** (MuseScore copy) | 0.13 | 1.63× | | | `MuseScore/fonts/mscore/metadata.json:22` |
| 11 | **MuseJazz** | 0.20 | 2.00× | | | `MuseScore/fonts/musejazz/metadata.json:22` |
| 12 | **Finale Maestro** (font = Maestro default document) | 0.091 | **1.00×** | UNKNOWN | UNKNOWN | `Finale Maestro.json:22`; `MaestroFontDefaultWin.enigmaxml:1242` |
| 13 | **Finale — other default documents** | 0.083–0.167 | 1.00× (Patterson, Handwritten, Broadway); 0.66× (Jazz); 1.60× (Finale Jazz) | UNKNOWN | UNKNOWN | musxdom `tests/data/reference/*` (§3.1) |
| 14 | **MuseScore** | 0.10 | **0.91×** | ✅ proportional | ✅ × 0.7 | `styledef.cpp:257, 277, 515, 517`; `tdraw.cpp:2602` |
| 15 | **LilyPond** | 0.13 @ 20 pt | **1.30×** (fixed ratio to the staff LINE) | ⚠️ follows the line (affine in pt) | ⛔ no; never thins under `\magnifyMusic` | `define-grobs.scm:3475`; `stem.cc:909-912`; `music-functions-init.ly:1065` |
| 16 | **Verovio** | 0.10 | **1.33×** | ✅ proportional | ⛔ no | `options.cpp:1533`; `view_element.cpp:1780-1781` |
| 17 | **VexFlow 5** | 0.15 @ 10 px/sp | **1.50×** | ⛔ fixed px | ⛔ no | `tables.js:595`; `stem.js:125` |
| 18 | **ours today** | 0.15 (ink) / 0.12 (room) | **1.36×** | ✅ via `scale(k)` | n/a | `EngravedNote.ts:100`; `bravuraMetrics.ts:360`; `staffLines.ts:179` |

⭐ **Beamed vs unbeamed:** every engine and font above uses **one** stem thickness for both, and
Gould's beamed plate (p. 490) matches her unbeamed one (p. 14). ⛔ No source was found that
thickens or thins a beamed stem, and none says it should.

## 6. ⛔ UNKNOWN — searched, not found

1. **An absolute stem thickness from any treatise.** None (`stem-length-research.md` §6.1). Stone:
   no statement.
2. **Grace/cue stem thickness in prose.** Gould pp. 125 and 569 scale *tails, beams, articulation,
   accidentals* and thin *ledger lines*, but ⛔ never mention stem weight. Ross, Stone and G&L were
   not found to address it. Only Gould's p. 125 plate speaks (§2.4).
3. **Finale's factory default** `stemWidth`. musxdom holds no default, and the `*Default*` fixtures'
   provenance is undocumented (§3.1). How Finale scales a stem with staff or note size: not in the
   model.
4. **Sebastian, Finale Jazz / Broadway / Ash, Ekmelos, Eugene** `stemThickness`. ⛔ No metadata JSON on
   disk (`docs/research/smufl-fonts-research.md` §3, §7).
5. **Dorico / Sibelius** defaults. Not on disk, not consulted.
6. **Ross's absolute stem weight.** His reproduction thins hairlines (`staff-line-research.md` §3.4).
   §2.2's ratio is a direction, not a number.
7. **Whether Gould's p. 125 excess (1.0–1.3×) is her engraving or this figure's production.** One
   small figure. Resolving it needs more small-note plates measured (e.g. her cue examples,
   pp. 570–572).
8. **Screen hinting** of a 1.1–1.5 px stem. No book can answer; as for the staff line
   (`staff-line-research.md` §9).
