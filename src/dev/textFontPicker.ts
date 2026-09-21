/**
 * 🔧 **DEV text-font picker — SCAFFOLDING** (`docs/plans/text-font-switch-plan.md`).
 *
 * The score's WORDS (`fonts/textFont`) — ⛔ not the music font, and not tied to it. The note beside
 * the select names the styles the face has no real file for and where they go instead: that is the
 * answer to *"why is the tempo still Academico?"* with Nepomuk chosen (it has no bold).
 */
import {
  DEFAULT_TEXT_FONT, TEXT_FONTS, activeTextFont, setActiveTextFont, textFamily, type TextStyle,
} from '../engine/fonts/textFont'
import { buildDevFontSelect } from './devFontSelect'

const STYLES: readonly { style: TextStyle; usedBy: string }[] = [
  { style: 'regular', usedBy: 'numbers, annotations' },
  { style: 'bold', usedBy: 'tempo words' },
  { style: 'italic', usedBy: 'expression words, the (parentheses) of trill / ottava / pedal' },
  { style: 'boldItalic', usedBy: 'nothing yet' },
]

export function buildTextFontPicker(renderScore: () => void): HTMLElement {
  return buildDevFontSelect({
    label: '🔧 DEV text: ',
    title: 'Experimental text-font switch — the score’s words. Separate from the music font. Not saved.',
    rows: TEXT_FONTS,
    active: () => activeTextFont().id,
    choose: setActiveTextFont,
    note: () => {
      const face = activeTextFont()
      const missing = STYLES.filter(row => !face.styles.includes(row.style))
      return {
        text: missing.length ? ` no ${missing.map(row => row.style).join(' / ')}` : '',
        title: STYLES.map(row =>
          `${row.style} (${row.usedBy}): ${textFamily(row.style)}`
          + (face.styles.includes(row.style) ? '' : face.id === DEFAULT_TEXT_FONT ? '  ← not shipped' : '  ← fallback')).join('\n'),
      }
    },
    renderScore,
  })
}
