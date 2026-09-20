/**
 * ⭐ THE KEYPAD'S BAKE — turns each hand-stacked drawing of the Beams/Tremolos page
 * (`keypadLayouts.KEYPAD_BAKE_RECIPES`) into fixed OUTLINES and writes
 * `src/windows/keypad/keypadBakedIcons.ts`. Run with `npm run bake:keypad`.
 *
 * Why a BROWSER: where a glyph lands is the browser's text layout (`text-anchor`, `dominant-baseline:
 * central` off the font's metrics). So the browser is ASKED — `getStartPositionOfChar`, at 100% zoom,
 * drawn 20× so the answer is not rounded to a pixel — and the glyph's outline (opentype.js, from the
 * same `public/fonts/Bravura.otf` the page draws with) is put exactly there. `outlineText.ts` makes
 * the PDF the same way.
 *
 * It PROVES itself before writing: the outline picture is screenshotted over the text picture, and
 * a bake whose ink differs by more than a hairline is refused.
 */
import { test, expect } from '@playwright/test'
import opentype from 'opentype.js'
import { decode } from 'fast-png'
import { readFileSync, writeFileSync } from 'node:fs'
import { glyphPathData } from '../src/engine/export/glyphOutline'

const OUT = 'src/windows/keypad/keypadBakedIcons.ts'
const SCALE = 20 // on-screen px per unit of the 26-unit box
const PAD = 26 // units of margin around the box, so a stem that overflows it is still in the shot

interface Measured { name: string; recipe: string; layers: { cp: number; x: number; y: number; size: number }[] }

test('bake the keypad drawings to outlines', async ({ page }) => {
  await page.goto('/opus-editor/e2e/harness.html')
  const measured: Measured[] = await page.evaluate(async ({ scale, pad }) => {
    const base = '/opus-editor/src'
    const layouts = await import(/* @vite-ignore */ `${base}/windows/keypad/keypadLayouts.ts`)
    const bake = await import(/* @vite-ignore */ `${base}/windows/keypad/tremoloBake.ts`)
    // ⚠️ The font is registered by the ENGINE's own loader — until it has settled every glyph is a
    // fallback box, and a position measured against a box is a wrong position (the first bake did).
    const fonts = await import(/* @vite-ignore */ `${base}/engine/rendering/painter/musicFontReady.ts`)
    await fonts.musicFontReady()
    await document.fonts.load('26px Bravura', '\uE1D5')
    if (!document.fonts.check('26px Bravura')) throw new Error('Bravura did not load — nothing can be measured')
    const out = []
    const stage = document.createElement('div')
    stage.id = 'bake-stage'
    stage.style.cssText = 'position:absolute;left:0;top:0;background:#fff;color:#000;z-index:99999'
    document.body.appendChild(stage)
    for (const [name, layers] of Object.entries(layouts.KEYPAD_BAKE_RECIPES)) {
      const cell = document.createElement('div')
      cell.dataset.name = name
      cell.style.cssText = `padding:${pad * scale}px;display:inline-block`
      const svg = bake.bakeGlyphStack(layers, "Bravura, Academico, 'Noto Music', serif")
      svg.style.width = svg.style.height = `${26 * scale}px`
      svg.style.display = 'block'
      cell.appendChild(svg)
      stage.replaceChildren(cell)
      const placed = []
      for (const text of Array.from(svg.querySelectorAll('text'))) {
        const p = text.getStartPositionOfChar(0)
        const t = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(text.getAttribute('transform') ?? '')
        placed.push({
          cp: text.textContent.codePointAt(0),
          x: p.x + (t ? Number(t[1]) : 0),
          y: p.y + (t ? Number(t[2]) : 0),
          size: Number(text.getAttribute('font-size')),
        })
      }
      out.push({ name, recipe: bake.bakeRecipeKey(layers), layers: placed })
    }
    return out
  }, { scale: SCALE, pad: PAD })

  expect(measured.length, 'no recipes were read — did KEYPAD_BAKE_RECIPES move?').toBeGreaterThan(0)

  const font = opentype.parse(readFileSync('public/fonts/Bravura.otf').buffer as ArrayBuffer)
  const baked = measured.map(m => ({
    name: m.name,
    recipe: m.recipe,
    // ⚠️ Through `glyphPathData`, ⛔ never `toPathData(3)`: its optimiser drops a real corner of a thin shape.
    paths: m.layers.map(l => glyphPathData(font.charToGlyph(String.fromCodePoint(l.cp)).getPath(l.x, l.y, l.size))),
  }))

  // ---- the proof: outlines over text, picture by picture
  for (const b of baked) {
    const shot = async (paths: string[] | null) => {
      await page.evaluate(async ({ name, paths, scale, pad }) => {
        const base = '/opus-editor/src'
        const layouts = await import(/* @vite-ignore */ `${base}/windows/keypad/keypadLayouts.ts`)
        const bake = await import(/* @vite-ignore */ `${base}/windows/keypad/tremoloBake.ts`)
        const stage = document.getElementById('bake-stage')!
        const cell = document.createElement('div')
        cell.style.cssText = `padding:${pad * scale}px;display:inline-block`
        const svg = paths
          ? bake.bakedPathsSvg(paths)
          : bake.bakeGlyphStack(layouts.KEYPAD_BAKE_RECIPES[name], "Bravura, Academico, 'Noto Music', serif")
        svg.style.width = svg.style.height = `${26 * scale}px`
        svg.style.display = 'block'
        cell.appendChild(svg)
        stage.replaceChildren(cell)
      }, { name: b.name, paths, scale: SCALE, pad: PAD })
      return decode(await page.locator('#bake-stage > div').screenshot())
    }
    const asText = await shot(null)
    if (process.env.BAKE_DEBUG) writeFileSync(`${process.env.BAKE_DEBUG}/${b.name}.text.png`, await page.locator('#bake-stage > div').screenshot())
    const asPaths = await shot(b.paths)
    if (process.env.BAKE_DEBUG) { writeFileSync(`${process.env.BAKE_DEBUG}/${b.name}.paths.png`, await page.locator('#bake-stage > div').screenshot()); console.log(b.name, JSON.stringify(measured.find(m => m.name === b.name)!.layers)) }
    expect(asPaths.width).toBe(asText.width)
    let ink = 0
    let differ = 0
    const ch = asText.channels
    for (let i = 0; i < asText.data.length; i += ch) {
      const a = asText.data[i] < 128
      const p = asPaths.data[i] < 128
      if (a || p) ink++
      if (a !== p) differ++
    }
    // Anti-aliasing differs between a text run and a filled path — measured 0.03–0.66% of the ink; a
    // misplaced or mis-drawn glyph differs by far more.
    if (process.env.BAKE_DEBUG) console.log(`${b.name}: ${(100 * differ / ink).toFixed(2)}% of the ink differs`)
    expect(differ / ink, `${b.name}: the outlines do not sit on the text drawing`).toBeLessThan(0.015)
  }

  const body = baked
    .map(b => `  {\n    name: '${b.name}',\n    recipe: '${b.recipe}',\n    paths: [\n${b.paths.map(d => `      '${d}',`).join('\n')}\n    ],\n  },`)
    .join('\n')
  writeFileSync(OUT, `/**
 * ⛔ GENERATED by \`npm run bake:keypad\` (e2e/keypadIcons.bake.ts) — do not edit.
 *
 * The Beams/Tremolos page's hand-stacked drawings (\`keypadLayouts.KEYPAD_BAKE_RECIPES\`) as fixed
 * OUTLINES in the keypad's 26-unit box, so a browser zoom cannot re-lay the glyphs. Each entry is
 * filed under the RECIPE it was baked from: tune a number in \`keypadLayouts.ts\` and that drawing
 * falls back to the live text form until it is baked again.
 */
/* eslint-disable max-len */
const BAKED: ReadonlyArray<{ name: string; recipe: string; paths: string[] }> = [
${body}
]

/** Baked outlines by RECIPE key (\`tremoloBake.bakeRecipeKey\`) — a recipe tuned since has no entry. */
export const KEYPAD_BAKED_ICONS: ReadonlyMap<string, readonly string[]> = new Map(BAKED.map(b => [b.recipe, b.paths]))
export const KEYPAD_BAKED_NAMES: readonly string[] = BAKED.map(b => b.name)
`)
  console.log(`baked ${baked.length} drawings → ${OUT}`)
})
