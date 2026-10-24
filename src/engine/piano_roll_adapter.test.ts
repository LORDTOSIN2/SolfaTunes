/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  getVoiceCategory,
  getVoiceTheme,
  enforceMonophony,
  formatAndReconstructScore,
  flattenScoreToPianoRoll,
  midiToNoteProperties,
  formatPitchLabel,
  FlatPianoRollNote,
} from './piano_roll_adapter';
import { AbcParser } from './abc_parser';
import { SolfaTransformer } from './solfa_transformer';

describe('Piano Roll Adapter & Monophony Engine', () => {
  it('correctly maps voices to SATB and Descant categories and themes', () => {
    expect(getVoiceCategory('S')).toBe('S');
    expect(getVoiceCategory('Soprano')).toBe('S');
    expect(getVoiceCategory('1')).toBe('S');
    expect(getVoiceCategory('A')).toBe('A');
    expect(getVoiceCategory('Alto')).toBe('A');
    expect(getVoiceCategory('2')).toBe('A');
    expect(getVoiceCategory('T')).toBe('T');
    expect(getVoiceCategory('Tenor')).toBe('T');
    expect(getVoiceCategory('B')).toBe('B');
    expect(getVoiceCategory('Bass')).toBe('B');
    expect(getVoiceCategory('D')).toBe('D');
    expect(getVoiceCategory('Descant')).toBe('D');

    // Themes
    expect(getVoiceTheme('S').hex).toBe('#F43F5E');
    expect(getVoiceTheme('A').hex).toBe('#F59E0B');
    expect(getVoiceTheme('T').hex).toBe('#10B981');
    expect(getVoiceTheme('B').hex).toBe('#6366F1');
    expect(getVoiceTheme('D').hex).toBe('#A855F7');
  });

  it('formats pitch labels and picks key-appropriate enharmonics', () => {
    expect(formatPitchLabel(60, 'C')).toBe('C4');
    expect(formatPitchLabel(62, 'C')).toBe('D4');
    expect(formatPitchLabel(61, 'G')).toBe('C♯4');
    expect(formatPitchLabel(70, 'F')).toBe('B♭4');
    expect(formatPitchLabel(71, 'C')).toBe('B4');
  });

  it('strictly enforces monophony within each channel', () => {
    const overlappingNotes: FlatPianoRollNote[] = [
      {
        id: '1',
        voiceId: 'S',
        startTick: 0,
        durationTicks: 16,
        midiPitch: 60,
        isRest: false,
        syllable: 'd',
      },
      {
        id: '2',
        voiceId: 'S',
        startTick: 8, // Overlaps with note 1 from tick 8 to 16
        durationTicks: 16,
        midiPitch: 64,
        isRest: false,
        syllable: 'm',
      },
      {
        id: '3',
        voiceId: 'A', // Different channel at same time position (tick 0)
        startTick: 0,
        durationTicks: 16,
        midiPitch: 55,
        isRest: false,
        syllable: 's',
      },
    ];

    const result = enforceMonophony(overlappingNotes);

    // Channel S notes must not overlap
    const sNotes = result.filter((n) => n.voiceId === 'S');
    expect(sNotes.length).toBe(2);
    expect(sNotes[0].startTick).toBe(0);
    // Note 1 must be truncated so it ends exactly where note 2 starts (tick 8)
    expect(sNotes[0].durationTicks).toBe(8);
    expect(sNotes[0].startTick + sNotes[0].durationTicks).toBe(8);
    expect(sNotes[1].startTick).toBe(8);

    // Channel A (Alto) is independent and preserved at tick 0
    const aNotes = result.filter((n) => n.voiceId === 'A');
    expect(aNotes.length).toBe(1);
    expect(aNotes[0].startTick).toBe(0);
    expect(aNotes[0].durationTicks).toBe(16);
  });

  it('replaces note when second note starts at the exact same tick in same channel', () => {
    const sameStartNotes: FlatPianoRollNote[] = [
      {
        id: '1',
        voiceId: 'S',
        startTick: 16,
        durationTicks: 16,
        midiPitch: 60,
        isRest: false,
        syllable: 'd',
      },
      {
        id: '2',
        voiceId: 'S',
        startTick: 16, // Same position
        durationTicks: 16,
        midiPitch: 67,
        isRest: false,
        syllable: 's',
      },
    ];

    const result = enforceMonophony(sameStartNotes);
    const sNotes = result.filter((n) => n.voiceId === 'S');
    expect(sNotes.length).toBe(1);
    expect(sNotes[0].midiPitch).toBe(67);
  });

  it('reconstructs and auto-formats score on blur with full measure rest-filling', () => {
    const rawAbc = `X:1\nT:Test Monophony\nM:4/4\nL:1/4\nK:G\nV:S\n[V:S] G A B c |`;
    const parser = new AbcParser();
    const { score: rawScore } = parser.parse(rawAbc);
    const transformer = new SolfaTransformer();
    const score = transformer.transform(rawScore);

    const { notes } = flattenScoreToPianoRoll(score);
    expect(notes.length).toBeGreaterThan(0);

    // Modify a note's pitch and duration
    notes[0].midiPitch = 67; // G4
    notes[0].durationTicks = 16;

    const formatted = formatAndReconstructScore(score, notes, 4);
    expect(formatted).toBeDefined();
    expect(formatted.systems.length).toBeGreaterThan(0);
    expect(formatted.key).toBe('G');
    expect(formatted.meter).toBe('4/4');

    // Notes in Soprano voice must be present and correctly populated
    const sLine = formatted.systems[0].voices['S'];
    expect(sLine).toBeDefined();
    expect(sLine.measures.length).toBeGreaterThan(0);
    expect(sLine.measures[0].notes.length).toBeGreaterThan(0);
  });
});
