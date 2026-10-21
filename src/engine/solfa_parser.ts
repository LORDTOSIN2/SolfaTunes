/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getKeyInfo, getKeyDefaultAccidentals, basePitchClass, pulseTicks } from './solfa_transformer';

const SYLLABLE_DEGREES: { [syl: string]: number } = {
  'd': 0, 'di': 1, 'de': 1, 'ra': 1,
  'r': 2, 'ri': 3, 're': 3, 'ma': 3,
  'm': 4,
  'f': 5, 'fi': 6, 'fe': 6,
  's': 7, 'si': 8, 'se': 8, 'la': 8,
  'l': 9, 'li': 10, 'le': 10, 'ta': 10,
  't': 11
};

/**
 * Resolves a Tonic Sol-fa syllable with octave marks to an integer MIDI pitch.
 */
export function solfaNoteToMidi(sylWithOct: string, key: string, voiceType: string): number {
  const normVoice = voiceType.toLowerCase();
  const refOct = (normVoice.includes('tenor') || normVoice.includes('bass') || normVoice === '3' || normVoice === '4') ? 4 : 5;

  let octDiff = 0;
  const syl = sylWithOct.trim();

  // Forgiving octave extraction
  if (syl.includes('₃') || /_3\b|3\b|,,,/.test(syl)) octDiff = -3;
  else if (syl.includes('₂') || /_2\b|2\b|,,/.test(syl)) octDiff = -2;
  else if (syl.includes('₁') || /_1\b|1\b|,/.test(syl)) octDiff = -1;
  else if (syl.includes('³') || /\^3|'''/.test(syl)) octDiff = 3;
  else if (syl.includes('²') || /\^2|''/.test(syl)) octDiff = 2;
  else if (syl.includes('¹') || /\^1|'|\*/.test(syl)) octDiff = 1;

  // Extract clean syllable letters
  const cleanSyl = syl.replace(/[₀₁₂₃₄₅⁶⁷⁸⁹⁰¹²³⁴0-9_,'*^]/g, '').toLowerCase();
  const deg = SYLLABLE_DEGREES[cleanSyl] !== undefined ? SYLLABLE_DEGREES[cleanSyl] : 0;

  const keyInfo = getKeyInfo(key);
  const solfaOctave = refOct + octDiff;
  return 12 * solfaOctave + keyInfo.tonic + deg;
}

/**
 * Converts MIDI pitch to standard ABC token in the given key signature.
 */
export function midiToAbcNote(midi: number, key: string): string {
  const keyInfo = getKeyInfo(key);
  const defaultAccs = getKeyDefaultAccidentals(keyInfo.sharpsFlats);
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1; // C4 (60) -> oct 4

  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  let bestLetter = 'C';
  let bestAcc = '';
  let bestScore = 999;

  for (const letter of letters) {
    const basePc = basePitchClass(letter);
    const keyAcc = defaultAccs[letter] || 0;
    const letterPc = (basePc + keyAcc + 12) % 12;

    if (letterPc === pc) {
      bestLetter = letter;
      bestAcc = '';
      bestScore = 0;
      break;
    }

    // Natural (=)
    if (basePc === pc && keyAcc !== 0) {
      if (1 < bestScore) {
        bestLetter = letter;
        bestAcc = '=';
        bestScore = 1;
      }
    }

    // Sharp (^)
    const sharpPc = (basePc + 1 + 12) % 12;
    if (sharpPc === pc) {
      const score = keyAcc === 0 ? 2 : 3;
      if (score < bestScore) {
        bestLetter = letter;
        bestAcc = '^';
        bestScore = score;
      }
    }

    // Flat (_)
    const flatPc = (basePc - 1 + 12) % 12;
    if (flatPc === pc) {
      const score = keyAcc === 0 ? 2 : 3;
      if (score < bestScore) {
        bestLetter = letter;
        bestAcc = '_';
        bestScore = score;
      }
    }
  }

  // Format letter case and octave marks
  let letterChar = bestLetter;
  let octMarks = '';
  if (oct === 4) {
    letterChar = bestLetter.toUpperCase();
  } else if (oct > 4) {
    letterChar = bestLetter.toLowerCase();
    if (oct > 5) octMarks = "'".repeat(oct - 5);
  } else if (oct < 4) {
    letterChar = bestLetter.toUpperCase();
    octMarks = ','.repeat(4 - oct);
  }

  return bestAcc + letterChar + octMarks;
}

/**
 * Formats a duration number (e.g. 1, 2, 1.5, 0.5, 0.25) to ABC duration suffix.
 */
function formatAbcDuration(dur: number): string {
  const rounded = Math.round(dur * 1000) / 1000;
  if (rounded === 1) return '';
  if (rounded === 2) return '2';
  if (rounded === 3) return '3';
  if (rounded === 4) return '4';
  if (rounded === 0.5) return '/2';
  if (rounded === 1.5) return '3/2';
  if (rounded === 0.25) return '/4';
  if (rounded === 0.75) return '3/4';
  if (Number.isInteger(rounded)) return rounded.toString();
  return `${rounded}`;
}

interface NoteEvent {
  pitchMidi?: number; // undefined if rest
  duration: number; // in quarter notes (L:1/4)
}

/**
 * Parses a measure's string of cells (e.g. "s₁ : s₁ : f₁") into NoteEvents.
 */
function parseMeasureEvents(measureStr: string, key: string, voiceType: string, isCompound: boolean): NoteEvent[] {
  const events: NoteEvent[] = [];
  const cells = measureStr.split(':').map(c => c.trim());
  const basePulseDur = isCompound ? 1.5 : 1.0;

  for (let cIdx = 0; cIdx < cells.length; cIdx++) {
    const cell = cells[cIdx];

    if (!cell || cell === '·' || cell === 'z' || cell === 'x') {
      events.push({ duration: basePulseDur }); // Rest
      continue;
    }

    // Continuation pulse '-'
    if (cell === '-') {
      if (events.length > 0) {
        events[events.length - 1].duration += basePulseDur;
      } else {
        events.push({ duration: basePulseDur });
      }
      continue;
    }

    // Sustained note + late starter: e.g. "-.r" or "- . r"
    if (cell.startsWith('-.') || cell.startsWith('- .')) {
      const lateSyl = cell.replace(/^[-\s.]+/, '').trim();
      if (events.length > 0) {
        events[events.length - 1].duration += basePulseDur * 0.5;
      }
      if (lateSyl) {
        const midi = solfaNoteToMidi(lateSyl, key, voiceType);
        events.push({ pitchMidi: midi, duration: basePulseDur * 0.5 });
      }
      continue;
    }

    // Two half-pulse parts: split by '.'
    if (cell.includes('.')) {
      const halves = cell.split('.');
      const halfDur = basePulseDur * 0.5;

      halves.forEach(half => {
        const trimmedHalf = half.trim();
        if (trimmedHalf === '-' && events.length > 0) {
          events[events.length - 1].duration += halfDur;
        } else if (trimmedHalf.includes(',')) {
          // Quarter pulses
          const quarters = trimmedHalf.split(',').map(q => q.trim());
          const qDur = halfDur / quarters.length;
          quarters.forEach(q => {
            if (q === '-' && events.length > 0) {
              events[events.length - 1].duration += qDur;
            } else if (q) {
              const midi = solfaNoteToMidi(q, key, voiceType);
              events.push({ pitchMidi: midi, duration: qDur });
            }
          });
        } else if (trimmedHalf) {
          const midi = solfaNoteToMidi(trimmedHalf, key, voiceType);
          events.push({ pitchMidi: midi, duration: halfDur });
        }
      });
      continue;
    }

    // Cell divided solely by commas: e.g. "d,r,m,f"
    if (cell.includes(',')) {
      const parts = cell.split(',').map(p => p.trim());
      const pDur = basePulseDur / parts.length;
      parts.forEach(p => {
        if (p === '-' && events.length > 0) {
          events[events.length - 1].duration += pDur;
        } else if (p) {
          const midi = solfaNoteToMidi(p, key, voiceType);
          events.push({ pitchMidi: midi, duration: pDur });
        }
      });
      continue;
    }

    // Single note in the pulse
    const midi = solfaNoteToMidi(cell, key, voiceType);
    events.push({ pitchMidi: midi, duration: basePulseDur });
  }

  return events;
}

/**
 * Converts a complete Tonic Sol-fa plain text score into valid ABC notation.
 */
export function parseSolfaToAbc(solfaText: string): { abcText: string; warnings: string[] } {
  const warnings: string[] = [];
  const lines = solfaText.split('\n');

  let key = 'C';
  let meter = '4/4';
  let title = 'Untitled Hymn';
  let composer = '';
  const metadataComments: string[] = [];
  const lyricsLines: string[] = [];

  interface VoiceEntry {
    prefix: string;
    voiceId: string;
    voiceName: string;
    clef: string;
    voiceType: string;
  }

  const voiceMap: { [prefix: string]: VoiceEntry } = {
    'S:': { prefix: 'S:', voiceId: '1', voiceName: 'Soprano', clef: 'treble', voiceType: 'soprano' },
    'A:': { prefix: 'A:', voiceId: '2', voiceName: 'Alto', clef: 'treble', voiceType: 'alto' },
    'T:': { prefix: 'T:', voiceId: '3', voiceName: 'Tenor', clef: 'treble', voiceType: 'tenor' },
    'B:': { prefix: 'B:', voiceId: '4', voiceName: 'Bass', clef: 'bass', voiceType: 'bass' },
    'D:': { prefix: 'D:', voiceId: '5', voiceName: 'Descant', clef: 'treble', voiceType: 'descant' }
  };

  let hasDescant = false;

  // 1. First pass: extract headers and detect voices
  lines.forEach(line => {
    const trimmed = line.trim();

    // Check KEY line
    const keyMatch = trimmed.match(/^KEY\s+([A-Ga-g][#b]?m?)/i);
    if (keyMatch) {
      key = keyMatch[1];
      // Check for M:[meter] in the same line
      const mMatch = trimmed.match(/M:([0-9]+\/[0-9]+)/i);
      if (mMatch) meter = mMatch[1];
      // Title and composer in key line
      const rest = trimmed.replace(/^KEY\s+[A-Ga-g][#b]?m?/i, '').replace(/M:[0-9]+\/[0-9]+/i, '').trim();
      if (rest) {
        const parts = rest.split(/\s{2,}|\t+/);
        if (parts[0]) title = parts[0].trim();
        if (parts[1]) composer = parts[1].trim();
      }
      return;
    }

    if (/^M:\s*([0-9]+\/[0-9]+)/i.test(trimmed)) {
      const mMatch = trimmed.match(/^M:\s*([0-9]+\/[0-9]+)/i);
      if (mMatch) meter = mMatch[1];
      return;
    }

    if (/^(?:TITLE:|T:)\s*(?!\|)([^|:]+)$/i.test(trimmed)) {
      title = trimmed.replace(/^(?:TITLE:|T:)\s*/i, '').trim();
      return;
    }

    if (/^C:\s*(.+)$/i.test(trimmed)) {
      composer = trimmed.replace(/^C:\s*/i, '').trim();
      return;
    }

    if (trimmed.startsWith('%')) {
      if (trimmed.includes('has_descant=true')) hasDescant = true;
      metadataComments.push(trimmed);
      return;
    }

    if (/^W:/i.test(trimmed)) {
      lyricsLines.push(trimmed);
      return;
    }

    if (/^D:/i.test(trimmed)) {
      hasDescant = true;
    }
  });

  const isCompound = meter === '6/8' || meter === '9/8' || meter === '12/8';

  // 2. Build ABC Headers
  const abcLines: string[] = [];
  abcLines.push('X:1');
  abcLines.push(`T:${title}`);
  if (composer) abcLines.push(`C:${composer}`);
  abcLines.push(`M:${meter}`);
  abcLines.push('L:1/4');
  abcLines.push(`K:${key}`);

  // Include metadata comments
  metadataComments.forEach(c => {
    if (!c.startsWith('% --- System')) {
      abcLines.push(c);
    }
  });

  // Staves and Voice headers
  if (hasDescant) {
    abcLines.push('%%staves [(5) (1 2) (3 4)]');
    abcLines.push('V:5 name="Descant" clef=treble');
  } else {
    abcLines.push('%%staves [(1 2) (3 4)]');
  }
  abcLines.push('V:1 name="Soprano" clef=treble');
  abcLines.push('V:2 name="Alto" clef=treble');
  abcLines.push('V:3 name="Tenor" clef=treble');
  abcLines.push('V:4 name="Bass" clef=bass');
  abcLines.push('');

  // 3. Process Systems and Voice Lines
  const barRegex = /(\|\]|\|\||::|:\||\|:|\|)/;

  lines.forEach(line => {
    const trimmed = line.trim();

    if (trimmed.startsWith('% --- System')) {
      abcLines.push(trimmed);
      return;
    }

    // Ignore headers, lyrics, comments in pass 2
    if (trimmed.startsWith('%') || /^W:/i.test(trimmed) || /^KEY\s+/i.test(trimmed) || (/^(?:M:|TITLE:|C:)\s*/i.test(trimmed) && !trimmed.includes('|'))) {
      return;
    }

    // Check voice lines: S:, A:, T:, B:, D: or V:id:
    const voiceMatch = trimmed.match(/^([A-Za-z0-9_]+:)\s*(.*)$/);
    if (!voiceMatch) return;

    const prefix = voiceMatch[1].toUpperCase();
    const content = voiceMatch[2];

    const isKnownVoice = !!voiceMap[prefix] || /^V:[A-Za-z0-9_]+:?$/i.test(prefix);
    if (!isKnownVoice) return;

    const voiceEntry = voiceMap[prefix] || {
      prefix,
      voiceId: prefix.replace(':', ''),
      voiceName: prefix.replace(':', ''),
      clef: 'treble',
      voiceType: 'soprano'
    };

    const parts = content.split(barRegex).map(p => p.trim());
    const measureAbcTokens: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      if (barRegex.test(part)) {
        measureAbcTokens.push(part);
      } else {
        const events = parseMeasureEvents(part, key, voiceEntry.voiceType, isCompound);
        const noteAbcStrings = events.map(ev => {
          const durStr = formatAbcDuration(ev.duration);
          if (ev.pitchMidi === undefined) {
            return `z${durStr}`;
          }
          const noteStr = midiToAbcNote(ev.pitchMidi, key);
          return `${noteStr}${durStr}`;
        });
        measureAbcTokens.push(noteAbcStrings.join(' '));
      }
    }

    const abcLine = `[V:${voiceEntry.voiceId}] ${measureAbcTokens.join(' ')}`.replace(/\s+/g, ' ').trim();
    abcLines.push(abcLine);
  });

  // Blank line before lyrics
  if (lyricsLines.length > 0) {
    abcLines.push('');
    lyricsLines.forEach(l => abcLines.push(l));
  }

  return { abcText: abcLines.join('\n'), warnings };
}
