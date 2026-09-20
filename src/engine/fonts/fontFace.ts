/**
 * ⭐⭐ **A FACE, NORMALISED AND WRITTEN AS CSS — VexFlow's `Font.validate` and `Font.toCSSString`, as
 * ours** (S13a of `docs/history/vexflow-removal-map.md`).
 *
 * Every face this editor draws or measures passed through these two on the way: `validate` fills the
 * gaps from the ROOT face (`Bravura,Academico`, 30 pt, normal, normal) and writes a numeric size as
 * POINTS (`30` → `'30pt'`); `toCSSString` is what a canvas is told before it measures
 * (`'italic bold 12pt Academico'`). Transcribed exactly — the SVG's `font-*` attributes and every
 * measured width depend on the strings they produce.
 *
 * ⛔ Not here: `Font.fromCSSString` (a CSS shorthand in, parsed by the DOM) — the one branch that
 * needs a page, so it lives with the SVG painter that is its only possible caller.
 * ⛔ No DOM, no vexflow.
 */
import { ROOT_FONT_FAMILY, ROOT_FONT_SIZE_PT } from './fontCategories'

/** A face as the painter and the measurer take it — `FontInfo`: a size is POINTS as a number, or a CSS size. */
export interface FontInfo {
  family?: string
  size?: number | string
  weight?: number | string
  style?: string
}

/** A face with every field filled, the size a CSS string — what {@link validateFont} answers. */
export interface ValidFont {
  family: string
  size: string
  weight: string
  style: string
}

/**
 * `Font.validate(f, size, weight, style)`, transcribed — for the object form and the positional form.
 * ⚠️ The bare-CSS-string form (`validate('12pt Foo')`) is the painter's (see the header).
 */
export function validateFont(
  f?: FontInfo | string, size?: number | string, weight?: number | string, style?: string,
): ValidFont {
  if (typeof f === 'string' && size === undefined && weight === undefined && style === undefined) {
    throw new Error(`validateFont: a bare CSS shorthand ("${f}") is parsed by the DOM — the painter's branch, not this one`)
  }
  let family: string | undefined
  if (typeof f === 'object') {
    family = f.family
    size = f.size
    weight = f.weight
    style = f.style
  } else {
    family = f
  }
  family = family ?? ROOT_FONT_FAMILY
  size = size ?? `${ROOT_FONT_SIZE_PT}pt`
  weight = weight ?? 'normal'
  style = style ?? 'normal'
  if (weight === '') weight = 'normal'
  if (style === '') style = 'normal'
  if (typeof size === 'number') size = `${size}pt`
  if (typeof weight === 'number') weight = weight.toString()
  return { family, size, weight, style }
}

/** `Font.toCSSString`, transcribed: `style weight size family`, a normal style or weight left out. */
export function fontToCss(font: FontInfo | undefined): string {
  if (!font) return ''
  const st = font.style
  const style = st === 'normal' || st === '' || st === undefined ? '' : st.trim() + ' '
  const wt = font.weight
  const weight = wt === 'normal' || wt === '' || wt === undefined ? ''
    : typeof wt === 'number' ? wt + ' ' : wt.trim() + ' '
  const sz = font.size
  // ⚠️ VexFlow's slip, kept: an ABSENT size is written with no space before the family.
  const size = sz === undefined ? `${ROOT_FONT_SIZE_PT}pt` : typeof sz === 'number' ? sz + 'pt ' : sz.trim() + ' '
  const family = font.family ?? ROOT_FONT_FAMILY
  return `${style}${weight}${size}${family}`
}
