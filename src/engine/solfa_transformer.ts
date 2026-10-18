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
function normalizeKey(keyStr: string | undefined): string {
  let clean = (keyStr || 'C').trim();
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
            // Scale duration by the default note length: durationTicks = mult * L_val * 16
            const durationMult = note.durationTicks;
            note.durationTicks = Math.round(durationMult * defaultLengthVal * 16);
            if (note.durationTicks <= 0) note.durationTicks = 1; // Safeguard

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

            // Solfa octave relative to tonic
            note.solfaOctave = Math.floor((note.midiPitch - keyInfo.tonic) / 12);
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
            if (!note.isRest && note.solfaOctave !== undefined) {
              octaves.push(note.solfaOctave);
            }
          });
        });
      });

      // Calculate statistical mode
      if (octaves.length > 0) {
        const frequency: { [val: number]: number } = {};
        let maxFreq = 0;
        let mode = 5; // fallback

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
        if (['B', 'BASS', '4'].includes(voice.id.toUpperCase())) {
          voiceHomeRegisters[voice.id] = 3;
        } else if (['T', 'TENOR', '3'].includes(voice.id.toUpperCase())) {
          voiceHomeRegisters[voice.id] = 4;
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
            if (!note.isRest && note.solfaOctave !== undefined) {
              note.octaveRelativeToVoice = note.solfaOctave - homeRegister;
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
              voiceMeasureLen += note.durationTicks;
            });
            if (voiceMeasureLen > measureDuration) {
              measureDuration = voiceMeasureLen;
            }
          }
        });

        // Fallback if measure is completely empty
        if (measureDuration === 0) {
          measureDuration = 16;
        }

        // Assign note timestamps relative to the measure start
        score.voices.forEach(voice => {
          const voiceLine = system.voices[voice.id];
          if (voiceLine && voiceLine.measures[mIndex]) {
            const measure = voiceLine.measures[mIndex];
            let noteOffset = 0;
            measure.notes.forEach(note => {
              note.timestamp = currentMeasureStart + noteOffset;
              noteOffset += note.durationTicks;
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
   * Uses analyzeMeasureCells to share logic with InteractiveRhythmLine.
   */
  public static formatMeasureRhythm(measure: Measure, meterOrDen?: string | number): string {
    let meterStr = '4/4';
    if (typeof meterOrDen === 'number') {
      meterStr = `4/${meterOrDen}`;
    } else if (typeof meterOrDen === 'string') {
      meterStr = meterOrDen;
    }
    const cells = analyzeMeasureCells(measure, meterStr);
    return cells
      .map(cell => cell.parts.map(p => p.items.map(it => it.text).join(',')).join('.'))
      .join(' : ');
  }
}

/**
 * Formats a Solfa syllable with combining diacritic dots for octave relative to voice.
 */
export function formatSolfaSyllable(syllable: string, octaveRelativeToVoice: number): string {
  let text = syllable;
  if (octaveRelativeToVoice > 0) {
    // Octave above: U+0307 (combining dot above). Limit to 2.
    const dots = '\u0307'.repeat(Math.min(octaveRelativeToVoice, 2));
    text = text.charAt(0) + dots + text.substring(1);
  } else if (octaveRelativeToVoice < 0) {
    // Octave below: U+0323 (combining dot below). Limit to 2.
    const dots = '\u0323'.repeat(Math.min(Math.abs(octaveRelativeToVoice), 2));
    text = text.charAt(0) + dots + text.substring(1);
  }
  return text;
}

/**
 * Calculates pulse ticks in sixteenth notes:
 * simple = 16/den; 6/8, 9/8, 12/8 = 6.
 */
export function pulseTicks(meter: string | undefined): number {
  if (!meter) return 4;
  const clean = meter.trim();
  if (clean === '6/8' || clean === '9/8' || clean === '12/8') {
    return 6;
  }
  const parts = clean.split('/');
  const den = parseInt(parts[1], 10) || 4;
  return Math.max(1, Math.round(16 / den));
}

export interface FormattedCellItem {
  type: 'note' | 'sustained' | 'rest';
  text: string;
  note?: SolfaNote;
  noteIndex?: number;
}

export interface FormattedCellPart {
  items: FormattedCellItem[];
}

export interface FormattedCell {
  parts: FormattedCellPart[];
}

/**
 * Shared helper: analyzes a measure's notes into pulse-divided cells.
 * - Pulse size is determined by pulseTicks(meter).
 * - Join notes inside one half-pulse with ",", across halves with ".".
 * - When a note is sustained into a cell AND other notes start inside it,
 *   render "-" then "." then those notes.
 */
export function analyzeMeasureCells(measure: Measure, meter: string | undefined): FormattedCell[] {
  const notes = measure.notes;
  if (notes.length === 0) return [];

  const pulse = pulseTicks(meter);
  const halfPulse = pulse / 2;

  // Map each note to its relative start/end in the measure
  let currentOffset = 0;
  const timeline = notes.map((note, index) => {
    const start = currentOffset;
    currentOffset += note.durationTicks;
    return {
      note,
      index,
      start,
      end: currentOffset
    };
  });

  const totalTicks = currentOffset;
  const cells: FormattedCell[] = [];

  const makeItem = (t: { note: SolfaNote; index: number }): FormattedCellItem => {
    if (t.note.isRest) {
      return { type: 'rest', text: '·', note: t.note, noteIndex: t.index };
    }
    const text = formatSolfaSyllable(t.note.syllable, t.note.octaveRelativeToVoice);
    return { type: 'note', text, note: t.note, noteIndex: t.index };
  };

  // Walk the timeline in chunks of pulse ticks
  for (let cellStart = 0; cellStart < totalTicks; cellStart += pulse) {
    const cellEnd = cellStart + pulse;
    const cellMid = cellStart + halfPulse;

    // Check if a note starts BEFORE cellStart and continues INTO cellStart
    const sustainedNote = timeline.find(t => t.start < cellStart && t.end > cellStart);

    // Find notes that start within this pulse cell
    const startingInCell = timeline.filter(t => t.start >= cellStart && t.start < cellEnd);

    if (sustainedNote && !sustainedNote.note.isRest) {
      const sustainedItem: FormattedCellItem = {
        type: 'sustained',
        text: '-',
        note: sustainedNote.note,
        noteIndex: sustainedNote.index
      };

      if (startingInCell.length === 0) {
        // Pure sustained note covering the whole cell
        cells.push({
          parts: [{ items: [sustainedItem] }]
        });
      } else {
        // Sustained note + late starter: render "-" then "." then those notes
        cells.push({
          parts: [
            { items: [sustainedItem] },
            { items: startingInCell.map(makeItem) }
          ]
        });
      }
    } else {
      if (startingInCell.length === 0) {
        if (sustainedNote && sustainedNote.note.isRest) {
          cells.push({
            parts: [{
              items: [{
                type: 'rest',
                text: '·',
                note: sustainedNote.note,
                noteIndex: sustainedNote.index
              }]
            }]
          });
        } else {
          cells.push({
            parts: [{
              items: [{
                type: 'sustained',
                text: '-'
              }]
            }]
          });
        }
      } else {
        // Notes start within this cell. Group into half-pulses.
        // Join notes inside one half-pulse with ",", across halves with ".".
        const firstHalf = startingInCell.filter(t => t.start < cellMid);
        const secondHalf = startingInCell.filter(t => t.start >= cellMid);

        const parts: FormattedCellPart[] = [];
        if (firstHalf.length > 0) {
          parts.push({ items: firstHalf.map(makeItem) });
        }
        if (secondHalf.length > 0) {
          if (firstHalf.length === 0 && sustainedNote && sustainedNote.note.isRest) {
            parts.push({
              items: [{
                type: 'rest',
                text: '·',
                note: sustainedNote.note,
                noteIndex: sustainedNote.index
              }]
            });
          }
          parts.push({ items: secondHalf.map(makeItem) });
        }
        cells.push({ parts });
      }
    }
  }

  return cells;
}
