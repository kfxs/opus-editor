import type { Widget } from './Widget'

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
    s.border = primary ? '1px solid #2563eb' : '1px solid #4b5563'
    s.background = primary ? '#2563eb' : '#374151'
    s.color = '#f3f4f6'
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

/** A line of text. */
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
    if (this.opts.muted) el.style.color = '#9ca3af'
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
    s.border = '1px solid #4b5563'
    s.background = '#111827'
    s.color = '#f3f4f6'
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
