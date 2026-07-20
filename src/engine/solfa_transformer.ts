/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore, System, VoiceLine, Measure, SolfaNote, ParseWarning } from '../types';

/**
 * Key mapping of standard major and minor keys to their tonic pitch class and sharp/flat count.
 * Pitch classes: C=0, C#/Db=1, D=2, D#/Eb=3, E=4, F=5, F#/Gb=6, G=7, G#/Ab=8, A=9, A#/Bb=10, B=11.
 */
interface KeyInfo {
  tonic: number;
  sharpsFlats: number;
}

const KEYS: { [key: string]: KeyInfo } = {
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

  // Minor keys (Suffix M represents relative major calculations)
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
  'ABM': { tonic: 8, sharpsFlats: -7 }
};

/**
 * Normalizes a key signature string into a dictionary-compliant format.
 */
function normalizeKey(keyStr: string): string {
  let clean = keyStr.trim();
  let isMinor = false;
  
  // Regex to check minor key endings: e.g., Am, G#m, Ebmin, Fminor
  const minMatch = clean.match(/^([A-Ga-g][#b]?)(m|min|minor)$/i);
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
function getKeyInfo(keyStr: string): KeyInfo {
  const norm = normalizeKey(keyStr);
  return KEYS[norm] || { tonic: 0, sharpsFlats: 0 };
}

/**
 * Returns standard chromatic accidental overrides for letters A-G from circle of fifths.
 */
function getKeyDefaultAccidentals(sharpsFlats: number): { [letter: string]: number } {
  const map: { [letter: string]: number } = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0, 'F': 0, 'G': 0 };
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
 * Maps pitch letter to base pitch class.
 */
function basePitchClass(letter: string): number {
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
 * Translates accidental string to numeric value.
 */
function parseAccidental(accStr: string | undefined): number | null {
  if (!accStr) return null;
  if (accStr === '^^') return 2;
  if (accStr === '^') return 1;
  if (accStr === '_') return -1;
  if (accStr === '__') return -2;
  if (accStr === '=') return 0;
  return null;
}

/**
 * Parses default note length, e.g., "1/4" -> 0.25, "1/8" -> 0.125
 */
function parseDefaultLength(lengthStr: string): number {
  if (!lengthStr.includes('/')) return 0.25;
  const parts = lengthStr.split('/');
  const num = parseFloat(parts[0]);
  const den = parseFloat(parts[1]);
  return isNaN(num) || isNaN(den) ? 0.25 : num / den;
}

/**
 * Maps scale degree 0-11 to Tonic Sol-fa syllable.
 */
const solfaSyllables = [
  'd', 'di', 'r', 'ri', 'm', 'f', 'fi', 's', 'si', 'l', 'li', 't'
];

/**
 * Tonic Sol-fa Transformer class.
 */
export class SolfaTransformer {
  constructor() {}

  /**
   * Performs resolution of all pitches, octave dot counts, and playback timings.
   */
  public transform(score: ParsedScore): ParsedScore {
    const keyInfo = getKeyInfo(score.key);
    const keyDefaultAccs = getKeyDefaultAccidentals(keyInfo.sharpsFlats);
    const defaultLengthVal = parseDefaultLength(score.defaultLength);

    // 1. Scale durations and resolve absolute pitch parameters
    score.systems.forEach(system => {
      score.voices.forEach(voice => {
        const voiceLine = system.voices[voice.id];
        if (!voiceLine) return;

        voiceLine.measures.forEach(measure => {
          // Reset accidental overrides for the measure
          const activeOverrides: { [letter: string]: number } = {};

          measure.notes.forEach(note => {
            // Scale duration by the default note length: durationInEighths = mult * L_val * 8
            const durationMult = note.durationInEighths;
            note.durationInEighths = Math.round(durationMult * defaultLengthVal * 8);
            if (note.durationInEighths <= 0) note.durationInEighths = 1; // Safeguard

            if (note.isRest) {
              note.syllable = '·';
              note.scaleDegree = 0;
              note.midiPitch = 0;
              return;
            }

            const letter = (note.rawLetter || 'C').toUpperCase();
            
            // Accidental resolution
            let effectiveOffset = 0;
            const explicitAcc = parseAccidental(note.rawAccidental);
            
            if (explicitAcc !== null) {
              effectiveOffset = explicitAcc;
              activeOverrides[letter] = explicitAcc; // Measure persistence
            } else if (activeOverrides[letter] !== undefined) {
              effectiveOffset = activeOverrides[letter];
            } else {
              effectiveOffset = keyDefaultAccs[letter] || 0;
            }

            // Absolute Pitch Class
            const pc = (basePitchClass(letter) + effectiveOffset + 12) % 12;
            
            // Scale Degree (Movable-Do relative to key signature's tonic)
            const deg = (pc - keyInfo.tonic + 12) % 12;
            note.scaleDegree = deg;
            note.syllable = solfaSyllables[deg];

            // MIDI pitch
            const oct = note.octaveNum !== undefined ? note.octaveNum : 4;
            note.midiPitch = 12 * (oct + 1) + pc;
          });
        });
      });
    });

    // 2. Compute Statistical Mode (home register) independently per voice across the ENTIRE score
    const voiceHomeRegisters: { [voiceId: string]: number } = {};

    score.voices.forEach(voice => {
      const octaves: number[] = [];

      score.systems.forEach(system => {
        const voiceLine = system.voices[voice.id];
        if (!voiceLine) return;

        voiceLine.measures.forEach(measure => {
          measure.notes.forEach(note => {
            if (!note.isRest && note.octaveNum !== undefined) {
              octaves.push(note.octaveNum);
            }
          });
        });
      });

      // Calculate statistical mode
      if (octaves.length > 0) {
        const frequency: { [val: number]: number } = {};
        let maxFreq = 0;
        let mode = 4; // fallback

        octaves.forEach(oct => {
          frequency[oct] = (frequency[oct] || 0) + 1;
          if (frequency[oct] > maxFreq) {
            maxFreq = frequency[oct];
            mode = oct;
          }
        });
        voiceHomeRegisters[voice.id] = mode;
      } else {
        // Fallbacks if voice is silent or has only rests
        if (['B', 'BASS', 'T', 'TENOR'].includes(voice.id.toUpperCase())) {
          voiceHomeRegisters[voice.id] = 3;
        } else {
          voiceHomeRegisters[voice.id] = 5;
        }
      }
    });

    // 3. Compute octaveRelativeToVoice based on home register
    score.systems.forEach(system => {
      score.voices.forEach(voice => {
        const voiceLine = system.voices[voice.id];
        if (!voiceLine) return;

        const homeRegister = voiceHomeRegisters[voice.id];

        voiceLine.measures.forEach(measure => {
          measure.notes.forEach(note => {
            if (!note.isRest && note.octaveNum !== undefined) {
              note.octaveRelativeToVoice = note.octaveNum - homeRegister;
            } else {
              note.octaveRelativeToVoice = 0;
            }
          });
        });
      });
    });

    // 4. Compute Playback Timestamps using a synchronized timeline across all voices!
    // This aligns the start of each measure for all voices, preventing drift or lag.
    let currentMeasureStart = 0;

    score.systems.forEach(system => {
      // Find the maximum number of measures among all voices in this system
      let systemMeasuresCount = 0;
      score.voices.forEach(voice => {
        const voiceLine = system.voices[voice.id];
        if (voiceLine && voiceLine.measures.length > systemMeasuresCount) {
          systemMeasuresCount = voiceLine.measures.length;
        }
      });

      for (let mIndex = 0; mIndex < systemMeasuresCount; mIndex++) {
        // Calculate the duration of this measure.
        // We'll use the maximum duration from any voice's measure as the reference.
        let measureDuration = 0;
        
        score.voices.forEach(voice => {
          const voiceLine = system.voices[voice.id];
          if (voiceLine && voiceLine.measures[mIndex]) {
            const measure = voiceLine.measures[mIndex];
            let voiceMeasureLen = 0;
            measure.notes.forEach(note => {
              voiceMeasureLen += note.durationInEighths;
            });
            if (voiceMeasureLen > measureDuration) {
              measureDuration = voiceMeasureLen;
            }
          }
        });

        // Fallback if measure is completely empty
        if (measureDuration === 0) {
          measureDuration = 8;
        }

        // Assign note timestamps relative to the measure start
        score.voices.forEach(voice => {
          const voiceLine = system.voices[voice.id];
          if (voiceLine && voiceLine.measures[mIndex]) {
            const measure = voiceLine.measures[mIndex];
            let noteOffset = 0;
            measure.notes.forEach(note => {
              note.timestamp = currentMeasureStart + noteOffset;
              noteOffset += note.durationInEighths;
            });
          }
        });

        // Advance the start of the next measure
        currentMeasureStart += measureDuration;
      }
    });

    return score;
  }

  /**
   * Formats a Measure's rhythm into beat-divided columns (e.g. m : - : m : r).
   * 
   * 1. Compute beat unit in eighth-note ticks: beatEighths = Math.round(8 / meterDenominator).
   * 2. Walk the eighth-tick timeline, chunking it into beatEighths-sized cells.
   * 3. Within each cell:
   *    - If a note is sustained into this position from earlier, place a dash '-'.
   *    - If a note starts, place its syllable.
   *    - If multiple notes start in the same cell, join them with a dot, e.g. 'd.r'.
   *    - If it is a rest starting, place '·'.
   */
  public static formatMeasureRhythm(measure: Measure, meterDenominator: number): string {
    const notes = measure.notes;
    if (notes.length === 0) return '';

    const beatEighths = Math.max(1, Math.round(8 / meterDenominator));

    // Map each note to its relative start/end in the measure
    let currentOffset = 0;
    const timeline = notes.map(note => {
      const start = currentOffset;
      currentOffset += note.durationInEighths;
      return {
        note,
        start,
        end: currentOffset
      };
    });

    const totalEighths = currentOffset;
    const cells: string[] = [];

    // Walk the timeline in chunks of beatEighths
    for (let cellStart = 0; cellStart < totalEighths; cellStart += beatEighths) {
      const cellEnd = cellStart + beatEighths;

      // Check if a note starts BEFORE cellStart and continues INTO cellStart
      const sustainedNote = timeline.find(t => t.start < cellStart && t.end > cellStart);

      if (sustainedNote && !sustainedNote.note.isRest) {
        // Sustained note spanning across the beat cell start boundary
        cells.push('-');
      } else {
        // Find notes that start within this beat cell
        const startingInCell = timeline.filter(t => t.start >= cellStart && t.start < cellEnd);

        if (startingInCell.length === 0) {
          // No note starts, but maybe a rest is sustained, or it's a gap
          if (sustainedNote && sustainedNote.note.isRest) {
            cells.push('·');
          } else {
            cells.push('-');
          }
        } else {
          // Format the starting notes
          const parts = startingInCell.map(t => {
            if (t.note.isRest) return '·';
            
            // Format syllable with combining diacritics for octave display
            let text = t.note.syllable;
            const diff = t.note.octaveRelativeToVoice;
            
            if (diff > 0) {
              // Octave above: U+0307 (combining dot above). Limit to 2.
              const dots = '\u0307'.repeat(Math.min(diff, 2));
              text = text.charAt(0) + dots + text.substring(1);
            } else if (diff < 0) {
              // Octave below: U+0323 (combining dot below). Limit to 2.
              const dots = '\u0323'.repeat(Math.min(Math.abs(diff), 2));
              text = text.charAt(0) + dots + text.substring(1);
            }
            return text;
          });

          // Join multiple notes in the same beat cell with a dot
          cells.push(parts.join('.'));
        }
      }
    }

    return cells.join(' : ');
  }
}
