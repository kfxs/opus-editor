#!/usr/bin/env node
/**
 * `npm run lint:paint` — **the `svgNode` escape may not grow.**
 *
 * A drawn group is a `DrawGroup` (`engine/paint/DrawGroup.ts`): a placement, an ink box, a discard,
 * two tags. `svgNode()` is the one way back from it to a real DOM element, and every use is either
 * the EDITOR being handed ink to highlight later, or a recolour / hide done through the page. Both
 * are real seams today; neither is a capability a recorded SCENE can offer, so each use is a place
 * the engine still needs a page. The count has one legitimate direction: down.
 *
 * Why a script: a design claim ("passes draw through `DrawContext`") cannot rot, because the types
 * enforce it. A repository claim ("only N places reach the DOM") can, and did — coupling of this
 * kind once grew 39% in 16 days while every stated rule was kept, because no number was being
 * looked at.
 *
 * Comments do not count. A ratchet that punishes writing down WHY gets routed around by not
 * explaining, so the residue is measured in code and prose about it is free.
 *
 * This script used to hold two more checks — an allowlist of files naming VexFlow's render context,
 * and a `vexContext` ceiling. Both reached zero when VexFlow was removed, and `lint:boundary` now
 * refuses the import in every file, so nothing is left for them to count.
 * History: docs/own-engraving-engine.md P1b / P1c.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = 'src'
const DOC = 'docs/own-engraving-engine.md'

/** A ceiling, not a target. Lower it when an escape goes; ⛔ never raise it — a new reach for the
 *  DOM wants a capability on `DrawGroup` instead. */
const SVG_NODE_CEILING = 16

/** The escape's own definition does not count against its ceiling. */
const DEFINITION = 'engine/rendering/svgDrawGroup.ts'

function isComment(line) {
  const t = line.trim()
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

const uses = []
for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split('\\').join('/')
  if (rel === DEFINITION) continue
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (!isComment(line) && /\bsvgNode\(/.test(line)) uses.push(`${rel}:${i + 1}`)
  })
}

if (uses.length > SVG_NODE_CEILING) {
  console.error(`
✗ \`svgNode\` is used ${uses.length} times; the ceiling is ${SVG_NODE_CEILING}.

${uses.map(u => `    ${u}`).join('\n')}

  A group is a DrawGroup: setPlacement / inkBox / discard / tag / tagLast. Reach for the DOM
  element only to hand drawn ink to the EDITOR, or to recolour it through the page — and if
  you are doing something else, it wants a capability on DrawGroup instead. See ${DOC} P1c.
`)
  process.exit(1)
}

console.log(`✓ ${uses.length}/${SVG_NODE_CEILING} \`svgNode\` escapes. Everything else draws through DrawContext and DrawGroup.`)
if (uses.length < SVG_NODE_CEILING) {
  console.log(`⭐ The count FELL — lower SVG_NODE_CEILING in scripts/check-paint-boundary.mjs to ${uses.length}.`)
}
