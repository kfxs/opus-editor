import { afterEach, describe, expect, it } from 'vitest'
import {
  TEXT_ROLES, textRoleFamily, textRoleSizePt, textRoleSlant, textRoleSpaces, textRoleWeight, type TextRole,
} from './textRoles'
import { DEFAULT_TEXT_FONT, setActiveTextFont } from '@/engine/fonts/textFont'
import { DEFAULT_MUSIC_FONT, setActiveMusicFont } from '@/engine/fonts/musicFont'

afterEach(() => {
  setActiveTextFont(DEFAULT_TEXT_FONT)
  setActiveMusicFont(DEFAULT_MUSIC_FONT)
})

describe('TEXT_ROLES', () => {
  it('⭐ every row is the value that ran before the table existed — in points, EXACTLY', () => {
    // ⚠️ `toBe`, not `toBeCloseTo`: a size is written into the SVG's markup, so 18.000000000000004
    //    would be a changed picture file even where no pixel moved.
    expect(textRoleSizePt('tempoWords')).toBe(18)
    expect(textRoleSizePt('tempoSymbol')).toBe(20)
    expect(textRoleSizePt('expression')).toBe(16)
    expect(textRoleSizePt('dynamicLetters')).toBe(30)
  })

  it('states them in staff spaces — the portable unit', () => {
    expect(textRoleSpaces('tempoWords')).toBeCloseTo(2.4, 10)
    expect(textRoleSpaces('expression')).toBeCloseTo(2.1333, 3)
    expect(textRoleSpaces('dynamicLetters')).toBeCloseTo(4, 10)
  })

  it('a tempo outranks an expression word (Gould p. 182), and the ♩ is cut larger than its words', () => {
    expect(textRoleSpaces('tempoWords')).toBeGreaterThan(textRoleSpaces('expression'))
    expect(textRoleSpaces('tempoSymbol')).toBeGreaterThan(textRoleSpaces('tempoWords'))
  })

  it('the books’ styles: tempo BOLD roman, expression and the parentheses ITALIC, never bold', () => {
    expect([textRoleWeight('tempoWords'), textRoleSlant('tempoWords')]).toEqual(['bold', 'normal'])
    expect([textRoleWeight('expression'), textRoleSlant('expression')]).toEqual(['normal', 'italic'])
    expect([textRoleWeight('lineParenthesis'), textRoleSlant('lineParenthesis')]).toEqual(['normal', 'italic'])
  })

  it('a parenthesis is sized by the sign it wraps, not by the table', () => {
    expect(TEXT_ROLES.lineParenthesis.size).toBe('ofItsSign')
  })

  it('⭐ a words row follows the TEXT face, a music row the MUSIC face — and neither the other', () => {
    const words: TextRole[] = ['tempoWords', 'expression', 'lineParenthesis']
    const music: TextRole[] = ['tempoSymbol', 'dynamicLetters']
    expect(words.map(textRoleFamily)).toEqual(['Academico', 'Georgia, "Times New Roman", Times, serif', 'Georgia, "Times New Roman", Times, serif'])
    expect(music.map(textRoleFamily)).toEqual(['Bravura,Academico', 'Bravura,Academico'])

    setActiveTextFont('edwin')
    expect(words.every(role => textRoleFamily(role).startsWith('Edwin,'))).toBe(true)
    expect(music.every(role => textRoleFamily(role).startsWith('Bravura,'))).toBe(true)

    setActiveMusicFont('leipzig')
    expect(music.every(role => textRoleFamily(role).startsWith('Leipzig,'))).toBe(true)
    expect(words.every(role => textRoleFamily(role).startsWith('Edwin,'))).toBe(true)
  })
})

describe('a symbol inside words — the `baseline` row', () => {
  it('the tempo’s note stands on its words’ baseline, with no extra offset yet', () => {
    expect(TEXT_ROLES.tempoSymbol.baseline).toEqual({ rule: 'onWordsBaseline', offsetSpaces: 0 })
  })

  it('no other role carries one — a dynamic’s letters are cut for a text line already', () => {
    const others = (Object.keys(TEXT_ROLES) as TextRole[]).filter(role => role !== 'tempoSymbol')
    expect(others.every(role => TEXT_ROLES[role].baseline === undefined)).toBe(true)
  })
})
