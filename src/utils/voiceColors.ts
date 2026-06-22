/**
 * Sibelius-style per-voice colours, indexed by 0-based MODEL voice
 * (0 = voice 1 = blue, 1 = voice 2 = green). The selection highlight, the ghost
 * note and the keyboard cursor all paint in the relevant voice's colour.
 *
 * Voice 1's blue is the app's existing ghost/cursor blue, so the single-voice
 * experience is unchanged. Out-of-range voices fall back to voice 1.
 */
const VOICE_FILL = ['#3B82F6', '#10B981'] as const
const VOICE_STROKE = ['#2563EB', '#059669'] as const

export function voiceFillColor(voice: number): string {
  return VOICE_FILL[voice] ?? VOICE_FILL[0]
}

export function voiceStrokeColor(voice: number): string {
  return VOICE_STROKE[voice] ?? VOICE_STROKE[0]
}
