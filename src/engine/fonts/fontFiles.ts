/**
 * ⭐⭐ **THE FONT FILES WE SHIP — one table, read by the screen AND by the PDF.**
 *
 * `public/fonts/` holds the faces the score is engraved in. Two places need them:
 *
 * | reader | what it does with a row |
 * |---|---|
 * | `rendering/painter/musicFontFaces` | registers it with the browser, so `font-family: Bravura` renders |
 * | `export/exportFonts` | parses it with opentype.js and OUTLINES the glyphs into the PDF |
 *
 * ## 🚨 Why this exists (`docs/history/vexflow-removal-map.md` S1)
 *
 * Until 2026-09-14 the screen never used these files. The browser had Bravura only because
 * importing VexFlow installs its own embedded copies — Bravura, Academico (both weights), Gonville,
 * Petaluma, Petaluma Script — measured in a live page. So removing the package would have blanked
 * every glyph, and the screen (VexFlow's copy) and the PDF (these files) were set in two different
 * builds of Academico: measured in Chromium, "Tempo I" in bold is 498 px wide at 120 px in VexFlow's
 * copy and 489 px in ours. Bravura's advances agree glyph for glyph.
 *
 * ## ⭐ A table of FACES, not "load Bravura" — the SMuFL fonts to come
 *
 * `docs/research/smufl-fonts-research.md` found five free SMuFL faces that ship outlines AND metadata
 * (Bravura, Leland, Petaluma, MuseJazz, Sebastian), arriving the way Bravura already does: a font
 * file in `public/fonts/` plus build-time metadata. A future house style that sets the music in
 * another face is one more ROW here — ⚠️ plus that face's metrics table, which is what
 * `fonts/bravuraMetrics.ts` is for Bravura. ⭐ WHICH music face is drawn is `fonts/musicFont`'s
 * (`docs/plans/music-font-switch-plan.md`); this table only says what files exist.
 *
 * No DOM: this module is data plus a URL (`engine/fonts/` is fenced by `lint:boundary`).
 */

/** One font file we ship, as the CSS font-matching world names it. */
export interface FontFile {
  /** The CSS family the drawing asks for — `<text font-family="Bravura">`. */
  family: string
  /** The file under `public/fonts/`. */
  file: string
  /** A separate file per weight, never a synthesised bold (a tempo mark is set in the real one). */
  weight: 'normal' | 'bold'
  /** A real italic is a separate FILE too — ⛔ never a slanted roman (absent means upright). */
  style?: 'italic'
  /** Music glyphs or the words around them. */
  role: 'music' | 'text'
  /**
   * How the face behaves while it loads. ⭐ VexFlow's own choices, kept: `block` for music, because
   * a fallback `.notdef` box engraved as a notehead is wrong ink; `swap` for words, which read
   * acceptably in a stand-in face for the moment it takes.
   */
  display: 'block' | 'swap'
}

export const FONT_FILES: readonly FontFile[] = [
  { family: 'Bravura', file: 'Bravura.otf', weight: 'normal', role: 'music', display: 'block' },
  // 🚧 EXPERIMENTAL — the dev shell's other music faces (`fonts/musicFont`,
  // docs/plans/music-font-switch-plan.md). OFL 1.1, from npm `@vexflow-fonts/*` 1.0.1; each face's
  // licence travels beside it (`public/fonts/<Family>-OFL.txt`).
  { family: 'Leipzig', file: 'Leipzig.otf', weight: 'normal', role: 'music', display: 'block' },
  { family: 'Sebastian', file: 'Sebastian.otf', weight: 'normal', role: 'music', display: 'block' },
  { family: 'Academico', file: 'Academico.otf', weight: 'normal', role: 'text', display: 'swap' },
  { family: 'Academico', file: 'AcademicoBold.otf', weight: 'bold', role: 'text', display: 'swap' },
  // 🚧 EXPERIMENTAL — the dev shell's other TEXT faces (`fonts/textFont`,
  // docs/plans/text-font-switch-plan.md). OFL 1.1; licences beside them as `<Family>-OFL.txt`.
  // Edwin 0.54 from MuseScore's tree (`fonts/edwin/` @ 929d1e9); Nepomuk from `fkretlow/nepomuk`
  // `redist/otf` @ c9681b3 — ⚠️ its author calls it unfinished, and it has no bold.
  { family: 'Edwin', file: 'Edwin-Roman.otf', weight: 'normal', role: 'text', display: 'swap' },
  { family: 'Edwin', file: 'Edwin-Italic.otf', weight: 'normal', style: 'italic', role: 'text', display: 'swap' },
  { family: 'Edwin', file: 'Edwin-Bold.otf', weight: 'bold', role: 'text', display: 'swap' },
  { family: 'Edwin', file: 'Edwin-BdIta.otf', weight: 'bold', style: 'italic', role: 'text', display: 'swap' },
  { family: 'Nepomuk', file: 'Nepomuk-Regular.otf', weight: 'normal', role: 'text', display: 'swap' },
  { family: 'Nepomuk', file: 'Nepomuk-Italic.otf', weight: 'normal', style: 'italic', role: 'text', display: 'swap' },
]

/** Where a font file is served — Vite's base path, so a non-root deployment finds it too. */
export function fontFileUrl(file: string): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env
  return `${env?.BASE_URL ?? '/'}fonts/${file}`
}
