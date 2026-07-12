/**
 * Keeping a MUSIC font from setting type.
 *
 * VexFlow's global font stack leads with a SMuFL music font (`Bravura,Academico`), and it is the
 * FIRST font in a stack that decides everything but the glyphs it happens to lack. Hand that stack
 * to something that draws text and Bravura quietly takes over the parts of the string that are not
 * letters — it has no Latin glyphs, so words fall through to the text face behind it and look
 * fine, but it DOES have a space, and a line box, and a caret height, and those are all sized for
 * notation rather than for type. Two bugs came from exactly this:
 *
 * - the tempo mark engraved as `Allegro(♩=144)` — the spaces were Bravura's, and Bravura's space
 *   is next to nothing wide;
 * - the text-edit caret three times the height of the word it sat in — the line box's strut came
 *   from Bravura's em box, which spans a staff.
 *
 * Moving the music font to the BACK fixes both without losing anything: it is never the strut and
 * never sets the spaces, but it is still there for per-character fallback, so a `♩` in the middle
 * of the string still finds a glyph.
 */

/** SMuFL music fonts — the ones VexFlow can lead its stack with. */
const MUSIC_FONT = /^(bravura|petaluma|gonville|leland|sebastian|musejazz|finale\w*)( text)?$/

/**
 * The same font stack with its music fonts moved to the back — for anything that draws TEXT.
 * Falls back to the original if that would leave nothing: a stack we don't recognise is better
 * than no stack. (Glyphs must NOT use this: they want the music font first.)
 */
export function textFirstFamily(family: string): string {
  const families = family.split(',').map(f => f.trim()).filter(Boolean)
  const isMusic = (f: string) => MUSIC_FONT.test(f.replace(/^["']|["']$/g, '').toLowerCase())
  const text = families.filter(f => !isMusic(f))
  const music = families.filter(isMusic)
  return text.length > 0 ? [...text, ...music].join(', ') : family
}
