/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SolfaTunes Musical Semantics Engine (Phase 2)
 *
 * This module defines the formal rules for pitch, key signatures, accidentals,
 * and Movable-Do Tonic Sol-fa mapping.
 *
 * MINOR KEY CONVENTION (DOCUMENTED EXPLICITLY):
 * ------------------------------------------------
 * In musical pedagogy, there are two common traditions for Movable-Do in minor keys:
 * 1. "La-based Minor": The tonic of the minor mode is sung as 'La', preserving the relative
 *    major's 'Do'.
 * 2. "Do-based Minor": The tonic of the minor mode is ALWAYS sung as 'Do' (degree 0),
 *    aligning with chromatic altered syllables for lowered intervals (e.g., minor 3rd = ri/ma,
 *    minor 6th = si/la, minor 7th = li/ta).
 *
 * SolfaTunes explicitly adheres to the DO-BASED MINOR convention:
 * - The tonic note of ANY key (major or minor) is degree 0 ('d' / Do).
 * - For minor keys (e.g. 'Am', 'Em', 'Dm'), `KEYS[normalizedKey].tonic` points directly to the
 *   minor tonic pitch class (e.g., A=9 for Am, E=4 for Em, D=2 for Dm).
 * - The key signature accidentals (`sharpsFlats`) reflect the circle-of-fifths key signature
 *   inherited from the relative major (e.g., A minor = 0 sharps/flats, D minor = -1 flat).
 * - As a result, pitch classes map relative to the tonic:
 *     Degree 0  (Tonic)        -> 'd'
 *     Degree 2  (Major 2nd)    -> 'r'
 *     Degree 3  (Minor 3rd)    -> 'ri'
 *     Degree 5  (Perfect 4th)  -> 'f'
 *     Degree 7  (Perfect 5th)  -> 's'
 *     Degree 8  (Minor 6th)    -> 'si'
 *     Degree 10 (Minor 7th)    -> 'li'
 *     Degree 11 (Leading tone) -> 't'
 * This ensures pitch-to-solfa mappings remain mathematically consistent, stable, and 100%
 * backward-compatible with all existing score parsing and playback tests.
 */

export interface KeyInfo {
  tonic: number;
  sharpsFlats: number;
}

/**
 * Standard pitch class numbers:
 * C=0, C#/Db=1, D=2, D#/Eb=3, E=4, F=5, F#/Gb=6, G=7, G#/Ab=8, A=9, A#/Bb=10, B=11.
 */
export const KEYS: { [key: string]: KeyInfo } = {
  // Major keys
  'C': { tonic: 0, sharpsFlats: 0 },
  'G': { tonic: 7, sharpsFlats: 1 },
  'D': { tonic: 2, sharpsFlats: 2 },
  'A': { tonic: 9, sharpsFlats: 3 },
  'E': { tonic: 4, sharpsFlats: 4 },
  'B': { tonic: 11, sharpsFlats: 5 },
  'F#': { tonic: 6, sharpsFlats: 6 },
  'C#': { tonic: 1, sharpsFlats: 7 },
  'F': { tonic: 5, sharpsFlats: -1 },
  'Bb': { tonic: 10, sharpsFlats: -2 },
  'Eb': { tonic: 3, sharpsFlats: -3 },
  'Ab': { tonic: 8, sharpsFlats: -4 },
  'Db': { tonic: 1, sharpsFlats: -5 },
  'Gb': { tonic: 6, sharpsFlats: -6 },
  'Cb': { tonic: 11, sharpsFlats: -7 },

  // Minor keys (Suffix M represents relative major calculations with minor tonic)
  'AM': { tonic: 9, sharpsFlats: 0 },
  'EM': { tonic: 4, sharpsFlats: 1 },
  'BM': { tonic: 11, sharpsFlats: 2 },
  'F#M': { tonic: 6, sharpsFlats: 3 },
  'C#M': { tonic: 1, sharpsFlats: 4 },
  'G#M': { tonic: 8, sharpsFlats: 5 },
  'D#M': { tonic: 3, sharpsFlats: 6 },
  'A#M': { tonic: 10, sharpsFlats: 7 },
  'DM': { tonic: 2, sharpsFlats: -1 },
  'GM': { tonic: 7, sharpsFlats: -2 },
  'CM': { tonic: 0, sharpsFlats: -3 },
  'FM': { tonic: 5, sharpsFlats: -4 },
  'BBM': { tonic: 10, sharpsFlats: -5 },
  'EBM': { tonic: 3, sharpsFlats: -6 },
  'ABM': { tonic: 8, sharpsFlats: -7 },
};

/**
 * Standard 12 chromatic degrees to Movable-Do Tonic Sol-fa syllables.
 * 0: do, 1: di, 2: re, 3: ri, 4: mi, 5: fa, 6: fi, 7: so, 8: si, 9: la, 10: li, 11: ti
 */
export const SOLFA_SYLLABLES: readonly string[] = [
  'd', 'di', 'r', 'ri', 'm', 'f', 'fi', 's', 'si', 'l', 'li', 't'
];

/**
 * Normalizes a key signature string into a dictionary-compliant format (e.g., 'Am' -> 'AM', 'Eb' -> 'Eb').
 */
export function normalizeKey(keyStr: string | undefined): string {
  const clean = (keyStr || 'C').trim();
  let isMinor = false;

  // Regex to check minor key endings: e.g., Am, G#m, Ebmin, Fminor, A minor
  const minMatch = clean.match(/^([A-Ga-g][#b]?)\s*(m|min|minor)$/i);
  let base = clean;
  if (minMatch) {
    base = minMatch[1];
    isMinor = true;
  }

  let normalizedBase = base.charAt(0).toUpperCase();
  if (base.length > 1) {
    const second = base.charAt(1);
    if (second === '#') normalizedBase += '#';
    else if (second.toLowerCase() === 'b') normalizedBase += 'b';
  }

  return normalizedBase + (isMinor ? 'M' : '');
}

/**
 * Returns key details. Defaults to C major if not found.
 */
export function getKeyInfo(keyStr: string): KeyInfo {
  const norm = normalizeKey(keyStr);
  return KEYS[norm] || { tonic: 0, sharpsFlats: 0 };
}

/**
 * Returns standard chromatic accidental overrides for letters A-G from circle of fifths.
 */
export function getKeyDefaultAccidentals(sharpsFlats: number): { [letter: string]: number } {
  const map: { [letter: string]: number } = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 };
  const sharpOrder = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const flatOrder = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

  if (sharpsFlats > 0) {
    for (let i = 0; i < Math.min(sharpsFlats, 7); i++) {
      map[sharpOrder[i]] = 1;
    }
  } else if (sharpsFlats < 0) {
    const numFlats = Math.abs(sharpsFlats);
    for (let i = 0; i < Math.min(numFlats, 7); i++) {
      map[flatOrder[i]] = -1;
    }
  }
  return map;
}

/**
 * Maps pitch letter to base pitch class (natural pitch without accidental).
 */
export function basePitchClass(letter: string): number {
  switch (letter.toUpperCase()) {
    case 'C': return 0;
    case 'D': return 2;
    case 'E': return 4;
    case 'F': return 5;
    case 'G': return 7;
    case 'A': return 9;
    case 'B': return 11;
    default: return 0;
  }
}

/**
 * Translates accidental string to numeric semitone alteration.
 * e.g., '^^' -> 2, '^' -> 1, '=' -> 0, '_' -> -1, '__' -> -2.
 */
export function parseAccidental(accStr: string | undefined): number | null {
  if (!accStr) return null;
  if (accStr === '^^') return 2;
  if (accStr === '^') return 1;
  if (accStr === '_') return -1;
  if (accStr === '__') return -2;
  if (accStr === '=') return 0;
  return null;
}

/**
 * Resolves the effective accidental for a note letter in a measure, taking into account:
 * 1. Explicit accidental on the note (which updates the measure's active overrides)
 * 2. Existing active accidental override in the measure
 * 3. Default accidental from the key signature
 */
export function resolveEffectiveAccidental(
  letter: string,
  rawAccidental: string | undefined,
  activeOverrides: { [letter: string]: number },
  keyDefaultAccs: { [letter: string]: number }
): { effectiveOffset: number; explicitAcc: number | null } {
  const normLetter = letter.toUpperCase();
  const explicitAcc = parseAccidental(rawAccidental);

  let effectiveOffset = 0;
  if (explicitAcc !== null) {
    effectiveOffset = explicitAcc;
    activeOverrides[normLetter] = explicitAcc; // Measure persistence
  } else if (activeOverrides[normLetter] !== undefined) {
    effectiveOffset = activeOverrides[normLetter];
  } else {
    effectiveOffset = keyDefaultAccs[normLetter] || 0;
  }

  return { effectiveOffset, explicitAcc };
}

/**
 * Calculates absolute pitch class (0-11) from letter and effective semitone offset.
 */
export function calculatePitchClass(letter: string, effectiveOffset: number): number {
  return (basePitchClass(letter) + effectiveOffset + 120) % 12;
}

/**
 * Calculates Movable-Do scale degree (0-11) relative to tonic pitch class.
 */
export function calculateScaleDegree(pitchClass: number, tonic: number): number {
  return (pitchClass - tonic + 120) % 12;
}

/**
 * Maps scale degree 0-11 to Sol-fa syllable.
 */
export function scaleDegreeToSyllable(scaleDegree: number): string {
  const deg = (scaleDegree % 12 + 12) % 12;
  return SOLFA_SYLLABLES[deg];
}

/**
 * Maps pitch class directly to Sol-fa syllable given a tonic.
 */
export function pitchClassToSolfaSyllable(pitchClass: number, tonic: number): string {
  const deg = calculateScaleDegree(pitchClass, tonic);
  return scaleDegreeToSyllable(deg);
}

/**
 * Calculates MIDI pitch (e.g. 60 for C4) from octave number and pitch class.
 */
export function calculateMidiPitch(octaveNum: number | undefined, pitchClass: number): number {
  const oct = octaveNum !== undefined ? octaveNum : 4;
  return 12 * (oct + 1) + pitchClass;
}

/**
 * Calculates Sol-fa octave relative to tonic: Math.floor((midiPitch - tonic) / 12).
 */
export function calculateSolfaOctave(midiPitch: number, tonic: number): number {
  return Math.floor((midiPitch - tonic) / 12);
}

/**
 * High-level note semantics resolution for a single note within measure context.
 * Computes pitchClass, scaleDegree, syllable, midiPitch, and solfaOctave.
 */
export function resolveNoteSemantics(params: {
  rawLetter?: string;
  rawAccidental?: string;
  octaveNum?: number;
  activeOverrides: { [letter: string]: number };
  keyInfo: KeyInfo;
  keyDefaultAccs: { [letter: string]: number };
}): {
  effectiveOffset: number;
  pitchClass: number;
  scaleDegree: number;
  syllable: string;
  midiPitch: number;
  solfaOctave: number;
} {
  const letter = (params.rawLetter || 'C').toUpperCase();
  const { effectiveOffset } = resolveEffectiveAccidental(
    letter,
    params.rawAccidental,
    params.activeOverrides,
    params.keyDefaultAccs
  );

  const pitchClass = calculatePitchClass(letter, effectiveOffset);
  const scaleDegree = calculateScaleDegree(pitchClass, params.keyInfo.tonic);
  const syllable = scaleDegreeToSyllable(scaleDegree);
  const midiPitch = calculateMidiPitch(params.octaveNum, pitchClass);
  const solfaOctave = calculateSolfaOctave(midiPitch, params.keyInfo.tonic);

  return {
    effectiveOffset,
    pitchClass,
    scaleDegree,
    syllable,
    midiPitch,
    solfaOctave,
  };
}

/**
 * Checks whether two pitch representations are enharmonically equivalent (same sounding pitch class).
 */
export function areEnharmonicallyEquivalent(
  noteA: { letter: string; accidental?: string | number; acc?: string | number },
  noteB: { letter: string; accidental?: string | number; acc?: string | number }
): boolean {
  const getOffset = (n: { accidental?: string | number; acc?: string | number }): number => {
    const raw = n.accidental !== undefined ? n.accidental : n.acc;
    if (typeof raw === 'number') return raw;
    const parsed = parseAccidental(raw);
    return parsed !== null ? parsed : 0;
  };

  const offsetA = getOffset(noteA);
  const offsetB = getOffset(noteB);

  const pcA = calculatePitchClass(noteA.letter, offsetA);
  const pcB = calculatePitchClass(noteB.letter, offsetB);
  return pcA === pcB;
}
