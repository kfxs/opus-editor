# The score's WORDS in another face — Edwin and Nepomuk beside Academico

> **Status: BUILT 2026-09-21, awaiting his UI check.** His ask, the same day the music face became a
> choice (`docs/plans/music-font-switch-plan.md`): *"lets do the multi font text, we will need an extra
> dropdown in the dev shell."* Rule he set first: *"text font is different than musical font."*
>
> 📄 Research, not repeated here: `docs/research/score-text-fonts-research.md` (why Academico, what each
> scorewriter sets each role in, the books' roman / italic / bold system, licences). Two surveys were
> commissioned WITH this work and are its sequel, not its input: `docs/research/music-text-fonts-research.md`
> (how a SMuFL "Text" companion such as Sebastian Text is used) and
> `docs/research/score-text-roles-research.md` (the standard model of a score's text ROLES — the
> building block a house style will set).

## 0. 🚨 What changed the brief: SEBASTIAN TEXT IS NOT A WORDS FONT

He named Sebastian Text as the first candidate. Measured 2026-09-21 on upstream's `SebastianText.otf`
1.35: **986 SMuFL glyphs, one style, and a Latin alphabet with no `D` and no `G`.** It is a SMuFL
*music-text* companion, the kind Bravura Text and Leland Text are — music symbols sized to sit INSIDE
a line of words — and the words beside it come from another family (Bravura Text ↔ Academico, Leland
Text ↔ Edwin). ⇒ His decisions: the words faces are **Academico · Edwin · Nepomuk**, and the face of
the symbols inside words is a **THIRD choice**, not built here.

> ⭐ **What the survey then found** (`docs/research/music-text-fonts-research.md`, same day): it is
> Sebastian re-cut for a text line — set ONLY the private-use characters of a run in it, at the words'
> own size; ⛔ never ahead of a words face in a stack (its ASCII slots are Finale's legacy symbol
> layout). For the one inline symbol we draw, the tempo's ♩, it changes nothing for Sebastian: the
> `metNote*` range is the same drawing in both files. Sebastian's metadata names **Nepomuk** as its
> words face — the pairing the picker already offers. MuseScore keeps the music-text font as a third,
> separate setting — the shape decided above.

## 1. Rules

1. **Three separate choices**: the music face (`fonts/musicFont`), the WORDS face (`fonts/textFont`),
   and — later — the music-text companion. ⛔ None is derived from another.
2. **A role asks for a STYLE, never for "the text font".** `textFamily('bold' | 'italic' | …)` answers
   with a stack LED BY A FACE THAT HAS A REAL FILE for that style. ⚠️ Decided in code, not left to
   CSS: a browser asked for bold in a family without one SYNTHESISES it instead of falling through
   (Ross: *"a tilted roman type should not be substituted for the italic"*).
3. **Academico stays the default and no pixel moves on it**: every answer for it is the string the
   engine used before — tempo words `Academico`, expression words the system stack
   `Georgia, "Times New Roman", Times, serif`. Specs stay pinned to it; another face is judged by his eye.
4. EXPERIMENTAL scaffolding: the dev shell's, not in the score JSON, not persisted.
5. ⛔ The title/composer sketch (`ScoreHeaderPass`) is NOT touched — it is to be thrown away. ⛔ Nor
   the UI chrome (menus' specimens, the gutter's Arial).

## 2. The faces

| face | files | styles | source · licence |
|---|---|---|---|
| **Academico** | shipped | regular · bold | Steinberg, OFL |
| **Edwin** 0.54 | `Edwin-{Roman,Italic,Bold,BdIta}.otf` | all FOUR | MuseScore `fonts/edwin/` @ `929d1e9` · OFL, RFN "Edwin" (`public/fonts/Edwin-OFL.txt`) |
| **Nepomuk** | `Nepomuk-{Regular,Italic}.otf` | regular · italic — ⛔ no bold | `fkretlow/nepomuk` `redist/otf` @ `c9681b3` (2020) · OFL, RFN "Nepomuk". ⚠️ Its author: *"nowhere near finished"* |

Style fallback: the active face → Academico → the system serif stack. So Nepomuk's tempo words are
Academico's bold, and Academico's italic is the system stack, as it always was.

⚠️ Both faces carry a few private-use glyphs (Edwin U+EFBF–EFFF, Nepomuk U+E865–E881) — outside every
range we draw, so a words-first stack cannot steal a music glyph today. Re-check when a range is added.

## 3. As built

- `fonts/textFont.ts` — the owner: `TEXT_FONTS`, `activeTextFont`, `setActiveTextFont`, `textFamily(style)`,
  `textFontGeneration()`. `FONT_FILES` rows gained `style?: 'italic'`.
- Roles pointed at it: **tempo words** (`tempoTextFont` → bold) · **expression words** and the dynamic's
  text runs (`expressionTextFamily()` → italic; was the constant `DYNAMIC_TEXT_FONT`) · the
  **(parentheses)** of trill / ottava / pedal (`trillParenFont()` …) · the text editor over a dynamic ·
  the **tail of the music-first stack** (`musicFontStack()` ends in `textFamily('regular')`), which is
  where measure numbers and annotations land.
- A text face nobody chose is not fetched (`musicFontFaces.loadMusicFont` loads all of a family's
  styles on the pick). The generation is in the width key and the layout key.
- ⭐ **PDF**: `exportFonts.fontKey` knows italic, and the outliner asks for the italic FILE for an
  italic run — ⛔ never the upright face. With Edwin, expression words are OUTLINED in the PDF for
  the first time; with Academico they stay text in a base-14 serif, as before.
- The picker (`dev/textFontPicker`) names the styles the face lacks; its tooltip says where each
  role's style actually goes.

## 4. Not here

- The music-text companion (Sebastian Text…) · the ROLE table with sizes (both: the two surveys above) ·
  lyrics, rehearsal marks, titles — roles the editor does not have yet · small capitals · the choice
  in a house style (`music-font-switch-plan.md` §4b).
