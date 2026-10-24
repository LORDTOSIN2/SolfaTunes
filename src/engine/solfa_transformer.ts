/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore, System, VoiceLine, Measure, SolfaNote, ParseWarning } from '../types';
import {
  KeyInfo,
  KEYS,
  normalizeKey,
  getKeyInfo,
  getKeyDefaultAccidentals,
  basePitchClass,
  parseAccidental,
  SOLFA_SYLLABLES,
  resolveNoteSemantics,
} from './solfa_semantics';
import { getTicksPerMeasure, TICKS_PER_WHOLE_NOTE } from './timing';

// Re-export for complete backward compatibility across the codebase
export type { KeyInfo };
export {
  KEYS,
  normalizeKey,
  getKeyInfo,
  getKeyDefaultAccidentals,
  basePitchClass,
  parseAccidental,
  SOLFA_SYLLABLES,
};

/**
 * Parses default note length, e.g., "1/4" -> 0.25, "1/8" -> 0.125
 */
function parseDefaultLength(lengthStr: string | undefined): number {
  if (!lengthStr || !lengthStr.includes('/')) return 0.25;
  const parts = lengthStr.split('/');
  const num = parseFloat(parts[0]);
  const den = parseFloat(parts[1]);
  return isNaN(num) || isNaN(den) ? 0.25 : num / den;
}

/**
 * Maps scale degree 0-11 to Tonic Sol-fa syllable.
 */
export const solfaSyllables = SOLFA_SYLLABLES;

/**
 * Tonic Sol-fa Transformer class.
 */
export class SolfaTransformer {
  constructor() {}

  /**
   * Performs resolution of all pitches, octave dot counts, and playback timings.
   */
  public transform(score: ParsedScore, options?: { rescaleDurations?: boolean }): ParsedScore {
    const rescale = options?.rescaleDurations ?? true;
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
            if (rescale) {
              // Scale duration by the default note length into piano-roll ticks.
              const durationMult = note.durationTicks;
              note.durationTicks = Math.round(durationMult * defaultLengthVal * TICKS_PER_WHOLE_NOTE);
              if (note.durationTicks <= 0) note.durationTicks = 1; // Safeguard
            }

            if (note.isRest) {
              note.syllable = '·';
              note.scaleDegree = 0;
              note.midiPitch = 0;
              return;
            }

            // Delegate note pitch, scale degree, syllable, and octave resolution to solfa_semantics
            const semantics = resolveNoteSemantics({
              rawLetter: note.rawLetter,
              rawAccidental: note.rawAccidental,
              octaveNum: note.octaveNum,
              activeOverrides,
              keyInfo,
              keyDefaultAccs,
            });

            note.scaleDegree = semantics.scaleDegree;
            note.syllable = semantics.syllable;
            note.midiPitch = semantics.midiPitch;
            note.solfaOctave = semantics.solfaOctave;
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
          measureDuration = getTicksPerMeasure(score.meter);
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
 * Calculates pulse ticks:
 * simple = 64/den; compound eighth-note meters use a dotted-quarter pulse.
 */
export function pulseTicks(meter: string | undefined): number {
  if (!meter) return 16;
  const clean = meter.trim();
  if (clean === '6/8' || clean === '9/8' || clean === '12/8') {
    return 24;
  }
  const parts = clean.split('/');
  const den = parseInt(parts[1], 10) || 4;
  return Math.max(1, Math.round(64 / den));
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
