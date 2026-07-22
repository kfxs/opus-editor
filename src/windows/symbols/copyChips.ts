import { CHROME } from '../../utils/chromeColors'
import { MUSIC_FONT } from './glyphSvg'
import type { Glyph } from './smufl'

/**
 * The copy row — the reason this window is also a development tool.
 *
 * One button that copies "the glyph" would have to pick, silently, which of five strings you meant.
 * So there is a chip per format, each LABELLED WITH THE STRING IT COPIES: what you click is what
 * lands on the clipboard, and nobody has to remember a setting.
 *
 * Every format is plain text, so it survives wherever it is going — a `.ts` file, the devtools
 * console, a commit message, a message to Claude.
 */

export interface CopyFormat {
  /** What the chip reads. For the character chip, the glyph itself — set in the music font. */
  label: string
  /** What lands on the clipboard. */
  value: string
  /** Draw the label in Bravura (the character chip) rather than the UI font. */
  music?: boolean
  /** The tooltip: what this format is FOR. */
  hint: string
}

/**
 * The five strings a glyph can leave here as.
 *
 * The escaped literal is the one that survives everywhere: pasted into the console it evaluates to
 * the glyph, pasted into a `.ts` file it compiles, and — unlike the bare character — it stays
 * VISIBLE in a diff, in a terminal, and in an editor with no music font. SMuFL lives in the Private
 * Use Area, where the literal character is an invisible box in most contexts.
 */
export function copyFormats(glyph: Glyph): CopyFormat[] {
  const formats: CopyFormat[] = [
    { label: glyph.name, value: glyph.name, hint: 'The canonical SMuFL name' },
    { label: glyph.codepoint, value: glyph.codepoint, hint: 'The codepoint, spelled as the spec does' },
    {
      label: escapeLiteral(glyph.char),
      value: escapeLiteral(glyph.char),
      hint: 'A TypeScript / JavaScript string literal — paste it into source or the console',
    },
    { label: glyph.char, value: glyph.char, music: true, hint: 'The character itself (invisible without a music font)' },
    { label: 'all', value: summary(glyph), hint: 'Name, codepoint, glyph and description — one line to paste into a message' },
  ]
  if (glyph.alternateCodepoint) {
    formats.splice(2, 0, {
      label: glyph.alternateCodepoint,
      value: glyph.alternateCodepoint,
      hint: 'The standard Unicode equivalent — works outside the Private Use Area',
    })
  }
  return formats
}

/** `''` → `'\uE0A4'`, with the braced form above the BMP where `\uXXXX` cannot reach. */
export function escapeLiteral(char: string): string {
  const code = char.codePointAt(0) ?? 0
  const hex = code.toString(16).toUpperCase()
  return code > 0xffff ? `'\\u{${hex}}'` : `'\\u${hex.padStart(4, '0')}'`
}

/** The one line to paste into a message: everything someone needs to identify the glyph. */
export function summary(glyph: Glyph): string {
  const description = glyph.description ? ` — ${glyph.description}` : ''
  return `${glyph.name} ${glyph.codepoint} ${glyph.char}${description}`
}

/** How long a chip says "copied" before going back to its label. */
const CONFIRM_MS = 1200

/**
 * The row of chips, rebuilt whenever the selected glyph changes.
 *
 * A copy that silently fails is worse than no button at all — there is no other feedback, and the
 * paste happens somewhere else entirely — so every chip reports, including the failure.
 */
export class CopyChips {
  private host: HTMLElement | null = null
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()

  mount(host: HTMLElement): void {
    host.style.display = 'flex'
    host.style.flexWrap = 'wrap'
    host.style.alignItems = 'center'
    host.style.gap = '6px'
    this.host = host
  }

  destroy(): void {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    this.host = null
  }

  setGlyph(glyph: Glyph | null): void {
    const host = this.host
    if (!host) return
    host.replaceChildren()
    if (!glyph) return

    const caption = document.createElement('span')
    caption.textContent = 'Copy:'
    caption.style.color = CHROME.inkMuted
    caption.style.fontSize = '12px'
    host.appendChild(caption)

    for (const format of copyFormats(glyph)) host.appendChild(this.chip(format))
  }

  private chip(format: CopyFormat): HTMLElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = format.label
    button.title = format.hint
    button.style.padding = '2px 8px'
    button.style.borderRadius = '4px'
    button.style.border = `1px solid ${CHROME.edge}`
    button.style.background = CHROME.field
    button.style.color = CHROME.ink
    button.style.cursor = 'pointer'
    button.style.fontSize = format.music ? '18px' : '12px'
    button.style.fontFamily = format.music ? MUSIC_FONT : 'ui-monospace, SFMono-Regular, Menlo, monospace'
    // A glyph chip is a line box again — and a tall glyph would be clipped by it. Room, and no
    // clipping: this one is a specimen the size of a word, not a picture, so a box is not needed.
    button.style.lineHeight = format.music ? '1' : 'inherit'
    button.style.overflow = 'visible'
    button.addEventListener('click', () => void this.copy(button, format))
    return button
  }

  private async copy(button: HTMLElement, format: CopyFormat): Promise<void> {
    const done = (message: string): void => {
      button.textContent = message
      const timer = setTimeout(() => {
        button.textContent = format.label
        this.timers.delete(timer)
      }, CONFIRM_MS)
      this.timers.add(timer)
    }
    try {
      await navigator.clipboard.writeText(format.value)
      done('copied')
    } catch {
      // Blocked (an insecure context, a denied permission) — say so rather than let a silent
      // failure be discovered at the paste.
      done('copy failed')
    }
  }
}
