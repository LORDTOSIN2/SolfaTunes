/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore, SolfaNote } from '../types';
import { TICKS_PER_WHOLE_NOTE } from './timing';

/**
 * Parses default note length, e.g., "1/4" -> 0.25, "1/8" -> 0.125
 */
function parseDefaultLength(lengthStr: string): number {
  if (!lengthStr || !lengthStr.includes('/')) return 0.25;
  const parts = lengthStr.split('/');
  const num = parseFloat(parts[0]);
  const den = parseFloat(parts[1]);
  return isNaN(num) || isNaN(den) ? 0.25 : num / den;
}

/**
 * Serializes a single SolfaNote back to ABC format.
 */
export function serializeNoteToAbc(note: SolfaNote, defaultLengthVal: number): string {
  if (note.isRest) {
    const restChar = note.rawLetter || 'z';
    // Calculate multiplier relative to default length.
    const mult = note.durationTicks / (defaultLengthVal * TICKS_PER_WHOLE_NOTE);
    const durStr = serializeDuration(mult);
    return `${restChar}${durStr}`;
  }

  // 1. Accidental
  const acc = note.rawAccidental || '';

  // 2. Letter and Octave marks
  const baseLetter = (note.rawLetter || 'C').toUpperCase();
  let abcLetter = baseLetter;
  let octaveMarks = '';

  const oct = note.octaveNum !== undefined ? note.octaveNum : 4;
  if (oct === 4) {
    abcLetter = baseLetter;
    octaveMarks = '';
  } else if (oct > 4) {
    abcLetter = baseLetter.toLowerCase();
    const apostrophes = oct - 5;
    if (apostrophes > 0) {
      octaveMarks = "'".repeat(apostrophes);
    }
  } else if (oct < 4) {
    abcLetter = baseLetter;
    const commas = 4 - oct;
    octaveMarks = ",".repeat(commas);
  }

  // 3. Duration
  const mult = note.durationTicks / (defaultLengthVal * TICKS_PER_WHOLE_NOTE);
  const durStr = serializeDuration(mult);

  return `${acc}${abcLetter}${octaveMarks}${durStr}`;
}

/**
 * Converts a floating point duration multiplier into standard ABC duration string.
 */
function serializeDuration(mult: number): string {
  // Round to nearest 0.001 to avoid floating-point issues
  const rounded = Math.round(mult * 1000) / 1000;
  
  if (rounded === 1) return '';
  if (rounded === 2) return '2';
  if (rounded === 3) return '3';
  if (rounded === 4) return '4';
  if (rounded === 6) return '6';
  if (rounded === 8) return '8';
  if (rounded === 0.5) return '/2';
  if (rounded === 0.25) return '/4';
  if (rounded === 1.5) return '3/2';
  if (rounded === 0.75) return '3/4';

  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }

  // Find simple fractions
  const eps = 0.005;
  for (let den = 2; den <= 16; den++) {
    const num = Math.round(rounded * den);
    if (Math.abs(num / den - rounded) < eps) {
      if (num === 1) return `/${den}`;
      return `${num}/${den}`;
    }
  }

  return rounded.toString();
}

/**
 * Converts a ParsedScore back into a clean, compliant ABC string.
 */
export function serializeScoreToAbc(score: ParsedScore): string {
  const lines: string[] = [];

  // 1. Headers
  if (score.index) lines.push(`X:${score.index}`);
  if (score.title) lines.push(`T:${score.title}`);
  if (score.composer) lines.push(`C:${score.composer}`);
  if (score.meter) lines.push(`M:${score.meter}`);
  if (score.defaultLength) lines.push(`L:${score.defaultLength}`);
  if (score.key) lines.push(`K:${score.key}`);

  // Extra metadata comments
  if (score.hymnMeter) lines.push(`% hymn_meter=${score.hymnMeter}`);
  if (score.tuneName) lines.push(`% tune_name=${score.tuneName}`);
  if (score.hymnName) lines.push(`% hymn_name=${score.hymnName}`);
  if (score.verses !== undefined) lines.push(`% verses=${score.verses}`);
  if (score.hasDescant !== undefined) lines.push(`% has_descant=${score.hasDescant}`);

  // 2. Voice pairings / %%staves if present
  if (score.voicePairingGroups && score.voicePairingGroups.length > 0) {
    const stavesStr = score.voicePairingGroups
      .map(group => {
        if (group.length > 1) {
          return `(${group.join(' ')})`;
        }
        return group[0];
      })
      .join(' ');
    lines.push(`%%staves [${stavesStr}]`);
  }

  // 3. Voice headers
  score.voices.forEach(voice => {
    lines.push(`V:${voice.id} name="${voice.name}" clef=${voice.clef}`);
  });

  lines.push(''); // Blank line after headers

  const defaultLengthVal = parseDefaultLength(score.defaultLength);

  // 4. Systems and measures
  score.systems.forEach((system, sIdx) => {
    lines.push(`% --- System ${sIdx + 1} ---`);

    score.voices.forEach(voice => {
      const voiceLine = system.voices[voice.id];
      if (!voiceLine || voiceLine.measures.length === 0) return;

      const measureStrings: string[] = [];
      voiceLine.measures.forEach((measure, mIdx) => {
        const noteStrings = measure.notes.map(note => serializeNoteToAbc(note, defaultLengthVal));
        const notesPart = noteStrings.join(' ');
        const barType = voiceLine.barTypes[mIdx] || '|';
        measureStrings.push(`${notesPart} ${barType}`);
      });

      lines.push(`[V:${voice.id}] ${measureStrings.join(' ')}`);
    });

    lines.push(''); // Blank line between systems
  });

  // Append lyrics if present
  if (score.lyrics && score.lyrics.length > 0) {
    score.lyrics.forEach(line => {
      if (line.trim() === '') {
        lines.push('W:');
      } else {
        lines.push(`W: ${line}`);
      }
    });
  }

  return lines.join('\n');
}
