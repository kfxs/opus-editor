import type { WindowLayer } from '../WindowLayer'
import type { Window } from '../Window'
import { Column, Columns, Row } from '../content/layout'
import { Button, ScrollText, Text } from '../content/widgets'
import { loremParagraphs } from '../content/lorem'

/**
 * The test rig behind the palette's *Lorem Window* button. Plain TS: defining a window is composing
 * widgets, and that has nothing to do with Vue — App.vue only calls this.
 *
 * Alternates on each call:
 *   - odd: two columns, each scrolling independently.
 *   - even: the whole text, nothing scrolling (`fitContent` sizes the window to it), and a centred
 *     Close button that closes the window it is in.
 */

let count = 0

export function openLoremWindow(windows: WindowLayer): Window {
  count++

  if (count % 2 === 1) {
    return windows.open({
      title: `Two Columns ${count}`,
      width: 460,
      height: 260,
      content: new Columns([
        new ScrollText(loremParagraphs(6)),
        new ScrollText(loremParagraphs(6)),
      ]),
    })
  }

  // The Close button closes the window it lives in, which is why the window is captured in a `let`:
  // the tree is built before `open()` returns, but the callback only runs long after it has.
  let win: Window | null = null
  win = windows.open({
    title: `Lorem Ipsum ${count}`,
    // Fixed size, and `fitContent` makes that size exactly the content's: nothing scrolls, nothing is
    // cut off, and there is nothing to resize. Wide on purpose — the height is whatever the text needs
    // once wrapped to this width, and it has to come out shorter than the viewport (~415px).
    width: 520,
    resizable: false,
    fitContent: true,
    content: new Column(
      [
        new Text(loremParagraphs(3)),
        new Row([new Button('Close', () => win?.close())], { align: 'center' }),
      ],
      { gap: 14 },
    ),
  })
  return win
}
