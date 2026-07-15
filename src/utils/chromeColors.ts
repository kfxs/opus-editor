/**
 * The chrome palette — the slate/gray + blue-600 scale that every plain-TS chrome surface is drawn
 * in: the window frame ({@link ../windows/WindowLayer}), a menu ({@link ../menus/MenuLayer}), the
 * toolkit widgets ({@link ../windows/content/widgets}), and the Keypad ({@link ../windows/keypad}).
 *
 * These were the same handful of hex literals copied across five files. A retune of the chrome meant
 * editing all five and hoping none was missed — and a miss is SILENT (one panel a shade off, noticed
 * only by eye). They live here now so the chrome is one edit, like the score's own shared colours
 * already do in {@link ./voiceColors}, which the chrome imports the same way.
 *
 * SCOPE — shared CHROME neutrals + the one accent, and nothing else. A colour used in exactly ONE
 * place is not duplication and stays a literal there (the window-close red, the menu's active-arrow
 * tint). SEMANTIC colours are not chrome and are NOT here: the Keypad's voice colours live in
 * {@link ./voiceColors}, and its mode/gutter ink stays local — those MEAN something and must be free
 * to differ from the neutral chrome, which a shared token would quietly prevent.
 *
 * Values are the Tailwind slate/gray + blue-600 scale (gray-700/600/100/400, blue-600, gray-900/800).
 */
export const CHROME = {
  /** Solid panel / key / titlebar surface (gray-700). */
  surface: '#374151',
  /** Border, separator, key edge — and the one step up the gray scale a hover brightens to (gray-600). */
  edge: '#4b5563',
  /** Primary text / glyph ink (gray-100). */
  ink: '#f3f4f6',
  /** Muted text — menu shortcuts, a hint label (gray-400). */
  inkMuted: '#9ca3af',
  /** The accent: a lit key, a primary button, an active/hovered menu row (blue-600). */
  accent: '#2563eb',
  /** Sunken field background — a text input (gray-900). */
  field: '#111827',
  /** The translucent chrome base (gray-800), behind the window/menu glass. Each surface applies its
   *  OWN alpha, so this is the raw `r, g, b` triple to drop into an `rgba(...)`. */
  glassRgb: '31, 41, 55',
  /** The floating-panel drop shadow, shared by the window frame and the menu panel. */
  shadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
} as const
