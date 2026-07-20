import type { Widget } from './Widget'
import { CHROME } from '../../utils/chromeColors'

/**
 * The leaf widgets. Dumb DOM builders, no state, no binding — see the warning in Widget.ts before
 * adding to this file.
 */

/** A run of prose that does NOT scroll — it is as tall as it needs to be. Pair with `fitContent`. */
export class Text implements Widget {
  constructor(private readonly paragraphs: string[]) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    el.style.flex = 'none'
    for (const text of this.paragraphs) {
      const p = document.createElement('p')
      p.textContent = text
      p.style.margin = '0 0 10px'
      el.appendChild(p)
    }
    if (el.lastElementChild) (el.lastElementChild as HTMLElement).style.marginBottom = '0'
    host.appendChild(el)
  }
}

/** A scrolling run of prose. It is the SCROLLER, so it works in a window box or in one grid cell. */
export class ScrollText implements Widget {
  constructor(private readonly paragraphs: string[]) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    el.style.overflowY = 'auto'
    el.style.flex = '1'
    el.style.minHeight = '0'
    el.style.paddingRight = '8px' // keep the scrollbar off the text

    for (const text of this.paragraphs) {
      const p = document.createElement('p')
      p.textContent = text
      p.style.margin = '0 0 10px'
      el.appendChild(p)
    }
    host.appendChild(el)
  }
}

/** One row of a {@link ChoiceList}: what it IS, and the picture that stands for it. */
export interface Choice {
  value: string
  /** SVG markup — the row is a PICTURE, not a caption (a clef is drawn, never spelled). */
  picture: string
}

/**
 * A sunken, scrolling box of pictures, exactly one of them chosen — the shape every "pick a
 * notation" dialog has (clef, key signature, time signature, instrument): a list you scroll, a row
 * you click, one selection at a time.
 *
 * It knows nothing about music. The caller draws the rows and names their values; this widget owns
 * the box, the scrolling, and which row is lit.
 */
export class ChoiceList implements Widget {
  private selected: string
  private readonly rows = new Map<string, HTMLElement>()

  constructor(
    private readonly choices: Choice[],
    private readonly opts: { selected?: string; onChange?: (value: string) => void } = {},
  ) {
    this.selected = opts.selected ?? choices[0]?.value ?? ''
  }

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    const s = el.style
    s.flex = '1'
    s.minHeight = '0'
    s.overflowY = 'auto'
    s.border = `1px solid ${CHROME.edge}`
    s.borderRadius = '6px'
    s.background = CHROME.field

    for (const choice of this.choices) {
      const row = document.createElement('div')
      row.innerHTML = choice.picture
      row.style.cursor = 'pointer'
      row.style.display = 'flex'
      row.style.justifyContent = 'center'
      row.addEventListener('click', () => this.select(choice.value))
      el.appendChild(row)
      this.rows.set(choice.value, row)
    }

    host.appendChild(el)
    this.paint()
  }

  get value(): string {
    return this.selected
  }

  private select(value: string): void {
    if (value === this.selected) return
    this.selected = value
    this.paint()
    this.opts.onChange?.(value)
  }

  private paint(): void {
    for (const [value, row] of this.rows) {
      // The lit row is a TINT, not the solid accent: the picture on it is the point, and a solid
      // blue behind a thin-stroked staff swallows it.
      row.style.background = value === this.selected ? 'rgba(37, 99, 235, 0.35)' : 'transparent'
    }
  }
}

export interface ButtonOptions {
  /** 'primary' is the one that commits — the Save in a Save window. */
  variant?: 'primary' | 'default'
  disabled?: boolean
}

/** A button. It calls back; it does not know what it is for. */
export class Button implements Widget {
  private el: HTMLButtonElement | null = null

  constructor(
    private readonly label: string,
    private readonly onClick: () => void,
    private readonly opts: ButtonOptions = {},
  ) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('button')
    el.type = 'button'
    el.textContent = this.label
    el.disabled = this.opts.disabled ?? false

    const primary = this.opts.variant === 'primary'
    const s = el.style
    s.padding = '6px 14px'
    s.borderRadius = '6px'
    s.border = `1px solid ${primary ? CHROME.accent : CHROME.edge}`
    s.background = primary ? CHROME.accent : CHROME.surface
    s.color = CHROME.ink
    s.font = 'inherit'
    s.fontWeight = '600'
    s.cursor = el.disabled ? 'default' : 'pointer'
    s.opacity = el.disabled ? '0.5' : '1'
    s.flex = 'none'

    el.addEventListener('click', () => this.onClick())
    host.appendChild(el)
    this.el = el
  }

  setDisabled(disabled: boolean): void {
    if (!this.el) return
    this.el.disabled = disabled
    this.el.style.cursor = disabled ? 'default' : 'pointer'
    this.el.style.opacity = disabled ? '0.5' : '1'
  }
}

/** A line of text. Reserved (with {@link TextInput}) for porting App.vue's custom-meter /
 *  pickup dialogs to plain-TS windows; no caller yet, kept as the ready building block. */
export class Label implements Widget {
  private el: HTMLElement | null = null

  constructor(
    private text: string,
    private readonly opts: { muted?: boolean } = {},
  ) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('div')
    el.textContent = this.text
    el.style.flex = 'none'
    if (this.opts.muted) el.style.color = CHROME.inkMuted
    host.appendChild(el)
    this.el = el
  }

  setText(text: string): void {
    this.text = text
    if (this.el) this.el.textContent = text
  }
}

/** A single-line text field. Reads its value on demand; it does not bind to anything. */
export class TextInput implements Widget {
  private el: HTMLInputElement | null = null

  constructor(
    private readonly opts: { value?: string; placeholder?: string; onEnter?: () => void } = {},
  ) {}

  mount(host: HTMLElement): void {
    const el = document.createElement('input')
    el.type = 'text'
    el.value = this.opts.value ?? ''
    if (this.opts.placeholder) el.placeholder = this.opts.placeholder

    const s = el.style
    s.padding = '6px 10px'
    s.borderRadius = '6px'
    s.border = `1px solid ${CHROME.edge}`
    s.background = CHROME.field
    s.color = CHROME.ink
    s.font = 'inherit'
    s.flex = 'none'
    s.minWidth = '0'

    if (this.opts.onEnter) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.opts.onEnter?.()
      })
    }
    host.appendChild(el)
    this.el = el
  }

  get value(): string {
    return this.el?.value ?? this.opts.value ?? ''
  }

  focus(): void {
    this.el?.focus()
    this.el?.select()
  }
}
