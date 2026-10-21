/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore } from '../types';
import { analyzeMeasureCells, pulseTicks } from './solfa_transformer';
import { alignSolfaGrid } from './solfa_aligner';

/**
 * Returns clean Curwen Tonic Sol-fa syllable with unicode subscript/superscript.
 * Voice reference octaves:
 * - Soprano, Alto, Descant: central solfaOctave is 5 (d=tonic in octave 4, e.g. Bb4 in K:Bb)
 * - Tenor, Bass: central solfaOctave is 4 (d is Bb3, d₁ is Bb2, l₂ is G2)
 */
export function formatTonicSolfaNote(
  syllable: string,
  solfaOctave: number,
  voiceType: 'descant' | 'soprano' | 'alto' | 'tenor' | 'bass' | string
): string {
  const normType = voiceType.toLowerCase();
  const refOct = (normType === 'tenor' || normType === 'bass' || normType === '3' || normType === '4') ? 4 : 5;
  const diff = solfaOctave - refOct;

  let mark = '';
  if (diff === -1) mark = '₁';
  else if (diff === -2) mark = '₂';
  else if (diff === -3) mark = '₃';
  else if (diff === 1) mark = '¹';
  else if (diff === 2) mark = '²';
  else if (diff === 3) mark = '³';

  return syllable + mark;
}

/**
 * Converts a ParsedScore into standard, human-readable Tonic Sol-fa plain text.
 */
export function serializeScoreToSolfa(score: ParsedScore): string {
  const lines: string[] = [];

  // 1. Header line: KEY [Key] [Title] [Composer] M:[Meter]
  const keyPart = `KEY ${score.key || 'C'}`;
  const titlePart = score.title ? `   ${score.title}` : '';
  const composerPart = score.composer ? `   ${score.composer}` : '';
  const meterPart = score.meter ? `   M:${score.meter}` : '';
  lines.push(`${keyPart}${titlePart}${composerPart}${meterPart}`);

  // Metadata comments
  if (score.tuneName) lines.push(`% tune_name=${score.tuneName}`);
  if (score.hymnName) lines.push(`% hymn_name=${score.hymnName}`);
  if (score.hymnMeter) lines.push(`% hymn_meter=${score.hymnMeter}`);
  if (score.hasDescant !== undefined) lines.push(`% has_descant=${score.hasDescant}`);
  if (score.verses !== undefined) lines.push(`% verses=${score.verses}`);

  lines.push('');

  // 2. Systems and Voice Lines
  score.systems.forEach((system, sIdx) => {
    lines.push(`% --- System ${sIdx + 1} ---`);

    score.voices.forEach(voice => {
      const voiceLine = system.voices[voice.id];
      if (!voiceLine || voiceLine.measures.length === 0) return;

      const vType = voice.name.toLowerCase();
      let voicePrefix = 'S:';
      if (vType.includes('descant') || voice.id === '5' || voice.id === 'D') voicePrefix = 'D:';
      else if (vType.includes('soprano') || voice.id === '1' || voice.id === 'S') voicePrefix = 'S:';
      else if (vType.includes('alto') || voice.id === '2' || voice.id === 'A') voicePrefix = 'A:';
      else if (vType.includes('tenor') || voice.id === '3' || voice.id === 'T') voicePrefix = 'T:';
      else if (vType.includes('bass') || voice.id === '4' || voice.id === 'B') voicePrefix = 'B:';
      else voicePrefix = `V:${voice.id}:`;

      const measureStrings: string[] = [];

      voiceLine.measures.forEach((measure, mIdx) => {
        const cells = analyzeMeasureCells(measure, score.meter);
        const cellStrings = cells.map(cell => {
          return cell.parts.map(part => {
            return part.items.map(it => {
              if (it.type === 'sustained') return '-';
              if (it.type === 'rest') return '·';
              if (it.note) {
                return formatTonicSolfaNote(
                  it.note.syllable,
                  it.note.solfaOctave !== undefined ? it.note.solfaOctave : 5,
                  vType
                );
              }
              return it.text || '-';
            }).join(',');
          }).join('.');
        });

        const barType = voiceLine.barTypes[mIdx] || '|';
        measureStrings.push(`${cellStrings.join(' : ')} ${barType}`);
      });

      lines.push(`${voicePrefix} | ${measureStrings.join(' ')}`);
    });

    lines.push('');
  });

  // 3. Lyrics
  if (score.lyrics && score.lyrics.length > 0) {
    score.lyrics.forEach(line => {
      if (line.trim() === '') {
        lines.push('W:');
      } else {
        lines.push(`W: ${line}`);
      }
    });
  }

  return alignSolfaGrid(lines.join('\n'));
}
