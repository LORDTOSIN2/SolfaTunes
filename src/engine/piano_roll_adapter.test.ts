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
  getMeterBeatTicks,
  getMeterTicksPerMeasure,
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

  it('uses score meter for bar and beat spacing, including compound meters', () => {
    expect(getMeterTicksPerMeasure('2/4')).toBe(32);
    expect(getMeterTicksPerMeasure('3/4')).toBe(48);
    expect(getMeterTicksPerMeasure('4/4')).toBe(64);
    expect(getMeterBeatTicks('2/4')).toBe(16);
    expect(getMeterBeatTicks('3/4')).toBe(16);
    expect(getMeterBeatTicks('4/4')).toBe(16);
    expect(getMeterBeatTicks('6/8')).toBe(24);
  });

  it('keeps piano-roll measures aligned to meter when source measures are underfilled', () => {
    const parser = new AbcParser();
    const { score: rawScore } = parser.parse(
      `X:1\nT:Underfilled Measures\nM:3/4\nL:1/4\nK:C\nV:S\n[V:S] C | D |`
    );
    const score = new SolfaTransformer().transform(rawScore);
    const { notes, measures } = flattenScoreToPianoRoll(score);

    expect(measures.map(({ startTick, durationTicks }) => [startTick, durationTicks])).toEqual([
      [0, 48],
      [48, 48],
    ]);
    expect(notes.find((note) => note.startTick >= 48)?.startTick).toBe(48);
  });

  it('maps ABC quarter notes to 16 piano-roll ticks and 64 pixels at the default zoom', () => {
    const { score: rawScore } = new AbcParser().parse(
      `X:1\nT:Quarter note timing\nM:2/4\nL:1/4\nK:C\nV:S\n[V:S] C D |`
    );
    const score = new SolfaTransformer().transform(rawScore);
    const { notes } = flattenScoreToPianoRoll(score);
    const sopranoNotes = notes.filter(note => note.voiceId === 'S' && !note.isRest);

    expect(sopranoNotes.map(({ startTick, durationTicks }) => [startTick, durationTicks])).toEqual([
      [0, 16],
      [16, 16],
    ]);
    expect(sopranoNotes[0].durationTicks * 4).toBe(64);
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

  it('correctly formats note duration labels and sol-fa octave accents', async () => {
    const { getNoteDurationLabel, formatSolfaOctaveLabel, midiToFrequency } = await import('./piano_roll_adapter');
    expect(getNoteDurationLabel(4)).toBe('Sixteenth note (1/16)');
    expect(getNoteDurationLabel(8)).toBe('Eighth note (1/8)');
    expect(getNoteDurationLabel(16)).toBe('Quarter note (1/4)');
    expect(getNoteDurationLabel(32)).toBe('Half note (1/2)');
    expect(getNoteDurationLabel(64)).toBe('Whole note (1)');

    expect(formatSolfaOctaveLabel('d', 0)).toBe('d');
    expect(formatSolfaOctaveLabel('d', 1)).toBe('d′');
    expect(formatSolfaOctaveLabel('d', 2)).toBe('d″');
    expect(formatSolfaOctaveLabel('s', -1)).toBe('s₁');
    expect(formatSolfaOctaveLabel('s', -2)).toBe('s₂');

    expect(midiToFrequency(69)).toBe(440); // A4
    expect(midiToFrequency(60)).toBeCloseTo(261.6, 1); // C4
  });

  it('correctly executes piano roll edits and synchronizes across ABC and Solfa views upon formatting', async () => {
    const { serializeScoreToAbc } = await import('./abc_serializer');
    const { serializeScoreToSolfa } = await import('./solfa_serializer');

    // 1. Initial 4/4 score in Key of C with Soprano: C D E F (d r m f)
    const initialAbc = `X:1\nT:Sync Test\nM:4/4\nL:1/4\nK:C\nV:S\n[V:S] C D E F |`;
    const parser = new AbcParser();
    const { score: rawScore } = parser.parse(initialAbc);
    const initialScore = new SolfaTransformer().transform(rawScore);

    // Initial Solfa string check
    const initialSolfa = serializeScoreToSolfa(initialScore);
    expect(initialSolfa).toContain('d');
    expect(initialSolfa).toContain('r');
    expect(initialSolfa).toContain('m');
    expect(initialSolfa).toContain('f');

    // 2. Flatten to Piano Roll notes
    const { notes } = flattenScoreToPianoRoll(initialScore);
    expect(notes.length).toBe(4);

    // 3. User makes changes in Piano Roll:
    // Change note 0 from C4 (60, d) to G4 (67, s)
    // Change note 1 from D4 (62, r) to E4 (64, m)
    notes[0].midiPitch = 67; // G4
    notes[1].midiPitch = 64; // E4

    // Simulated auto-format on blur DISABLED:
    // The parent initialScore remains unchanged while changes are only held in `notes`
    expect(initialScore.systems[0].voices['S'].measures[0].notes[0].midiPitch).toBe(60);
    expect(initialScore.systems[0].voices['S'].measures[0].notes[0].syllable).toBe('d');

    // 4. User explicitly triggers Format (or auto-format on blur executes):
    const updatedScore = formatAndReconstructScore(initialScore, notes, 8);
    expect(updatedScore).toBeDefined();

    // Verify visual score system has new pitches, syllables, and PRESERVED note durations (16 ticks, not 256)
    const sNotes = updatedScore.systems[0].voices['S'].measures[0].notes;
    expect(sNotes[0].midiPitch).toBe(67);
    expect(sNotes[0].syllable).toBe('s'); // Sol (G in Key C)
    expect(sNotes[0].durationTicks).toBe(16); // Preserved quarter note
    expect(sNotes[1].midiPitch).toBe(64);
    expect(sNotes[1].syllable).toBe('m'); // Mi (E in Key C)
    expect(sNotes[1].durationTicks).toBe(16); // Preserved quarter note

    // 5. Verify synchronization across ABC representation (not inflated to G16, E16)
    const updatedAbc = serializeScoreToAbc(updatedScore);
    expect(updatedAbc).toContain('G'); // First note is now G
    expect(updatedAbc).toContain('E'); // Second note is now E
    expect(updatedAbc).not.toContain('G16');
    expect(updatedAbc).not.toContain('E16');

    // 6. Verify synchronization across Tonic Sol-fa view
    const updatedSolfa = serializeScoreToSolfa(updatedScore);
    expect(updatedSolfa).toContain('s'); // 's' is now in the Solfa notation
    expect(updatedSolfa).toContain('m');
  });

  it('preserves exact timing across multiple consecutive formats without note elongation', async () => {
    const { serializeScoreToAbc } = await import('./abc_serializer');

    const abc = 'X:1\nT:Timing Test\nM:4/4\nL:1/4\nK:C\nV:S\n[V:S] C D E F |';
    let score = new SolfaTransformer().transform(new AbcParser().parse(abc).score);

    for (let i = 0; i < 3; i++) {
      const { notes } = flattenScoreToPianoRoll(score);
      score = formatAndReconstructScore(score, notes, 8);
      const sNotes = score.systems[0].voices['S'].measures[0].notes;
      expect(sNotes[0].durationTicks).toBe(16);
      expect(sNotes[1].durationTicks).toBe(16);
      expect(sNotes[2].durationTicks).toBe(16);
      expect(sNotes[3].durationTicks).toBe(16);

      const serialized = serializeScoreToAbc(score);
      expect(serialized).not.toContain('C16');
      expect(serialized).toContain('C D E F');
    }
  });

  it('confirms vertical grid line ticks strictly match meter definitions for 2/4, 3/4, 4/4, and 6/8', () => {
    // 2/4 meter: 2 quarter-note beats of 16 ticks each = 32 ticks per measure
    expect(getMeterTicksPerMeasure('2/4')).toBe(32);
    expect(getMeterBeatTicks('2/4')).toBe(16);
    expect(32 / getMeterBeatTicks('2/4')).toBe(2);

    // 4/4 meter: 4 quarter-note beats of 16 ticks each = 64 ticks per measure
    expect(getMeterTicksPerMeasure('4/4')).toBe(64);
    expect(getMeterBeatTicks('4/4')).toBe(16);
    expect(64 / getMeterBeatTicks('4/4')).toBe(4);

    // 3/4 meter: 3 quarter-note beats of 16 ticks each = 48 ticks per measure
    expect(getMeterTicksPerMeasure('3/4')).toBe(48);
    expect(getMeterBeatTicks('3/4')).toBe(16);
    expect(48 / getMeterBeatTicks('3/4')).toBe(3);

    // 6/8 compound meter: 2 dotted-quarter beats of 24 ticks each = 48 ticks per measure
    expect(getMeterTicksPerMeasure('6/8')).toBe(48);
    expect(getMeterBeatTicks('6/8')).toBe(24);
    expect(48 / getMeterBeatTicks('6/8')).toBe(2);
  });

  it('does not create unnecessary rests in pickup / anacrusis measures upon formatting', () => {
    // 2/4 meter with 1-beat pickup (16 ticks) in measure 0
    const abc = 'X:1\nT:Pickup Test\nM:2/4\nL:1/4\nK:C\nV:S\n[V:S] G | c G |';
    const initialScore = new SolfaTransformer().transform(new AbcParser().parse(abc).score);
    const { notes } = flattenScoreToPianoRoll(initialScore);

    // Format with 1/16 snap (4 ticks)
    const formatted4 = formatAndReconstructScore(initialScore, notes, 4);
    const m0Notes4 = formatted4.systems[0].voices['S'].measures[0].notes;
    expect(m0Notes4.length).toBe(1);
    expect(m0Notes4[0].isRest).toBe(false);
    expect(m0Notes4[0].durationTicks).toBe(16);

    // Format with 1/32 snap (2 ticks)
    const formatted2 = formatAndReconstructScore(initialScore, notes, 2);
    const m0Notes2 = formatted2.systems[0].voices['S'].measures[0].notes;
    expect(m0Notes2.length).toBe(1);
    expect(m0Notes2[0].isRest).toBe(false);
    expect(m0Notes2[0].durationTicks).toBe(16);
  });

  it('absorbs sub-snap micro-gaps without generating spurious 1-tick or 2-tick rests', () => {
    const abc = 'X:1\nT:Gap Test\nM:4/4\nL:1/4\nK:C\nV:S\n[V:S] C D E F |';
    const initialScore = new SolfaTransformer().transform(new AbcParser().parse(abc).score);
    const { notes } = flattenScoreToPianoRoll(initialScore);

    // Simulate note 0 ending at tick 14 (leaving a 2-tick gap before note 1 at tick 16)
    notes[0].durationTicks = 14;

    const formatted = formatAndReconstructScore(initialScore, notes, 4); // snapTicks = 4
    const sNotes = formatted.systems[0].voices['S'].measures[0].notes;
    // The micro-gap is absorbed so no rest is generated between notes
    const rests = sNotes.filter((n) => n.isRest);
    expect(rests.length).toBe(0);
    expect(sNotes.length).toBe(4);
  });

  it('correctly adapts Bishopthorpe MusicXML score into Piano Roll with 4 SATB channels and correct note mappings', async () => {
    const { SCORES } = await import('../utils/scores');
    const { MusicXmlParser } = await import('./musicxml/musicxml_parser');
    const bishopthorpe = SCORES.find((s) => s.fileName.includes('bishopthorpe'));
    expect(bishopthorpe).toBeDefined();
    if (!bishopthorpe || bishopthorpe.format !== 'musicxml') return;

    const xml = await bishopthorpe.loadXml();
    const { score } = MusicXmlParser.parse(xml);
    expect(score.title).toBe('Bishopthorpe');
    expect(score.key).toBe('G');
    expect(score.meter).toBe('3/4');

    const { notes, measures } = flattenScoreToPianoRoll(score);
    expect(measures.length).toBe(18);
    const channels = score.voices.map((v) => getVoiceCategory(v.name || v.id));
    expect(channels).toEqual(['S', 'A', 'T', 'B']);
    expect(notes.length).toBe(137);

    // Verify soprano voice notes
    const sopranoNotes = notes.filter((n) => n.voiceId === '1' && !n.isRest);
    expect(sopranoNotes.length).toBe(41);
    expect(sopranoNotes[0].syllable).toBe('s'); // D in Key G is sol
    expect(sopranoNotes[0].midiPitch).toBe(62); // D4

    // Ensure strict monophony (no overlapping notes) across every voice
    ['1', '2', '3', '4'].forEach((voiceId) => {
      const vNotes = notes.filter((n) => n.voiceId === voiceId && !n.isRest).sort((a, b) => a.startTick - b.startTick);
      for (let i = 0; i < vNotes.length - 1; i++) {
        const curEnd = vNotes[i].startTick + vNotes[i].durationTicks;
        const nextStart = vNotes[i + 1].startTick;
        expect(curEnd).toBeLessThanOrEqual(nextStart);
      }
    });

    // Specifically verify Soprano measures 2, 3, 4, 5 do not collide at measure boundaries
    // Measure 1 pickup (D4, C5): ticks 0..16, measure grid ends at 48
    // Measure 2 (B4, A4, G4): ticks 48..96
    const m2Notes = sopranoNotes.filter((n) => n.startTick >= 48 && n.startTick < 96);
    expect(m2Notes.map((n) => ({ pitch: n.midiPitch, start: n.startTick, dur: n.durationTicks }))).toEqual([
      { pitch: 71, start: 48, dur: 24 }, // B4 (dotted quarter)
      { pitch: 69, start: 72, dur: 8 },  // A4 (eighth)
      { pitch: 67, start: 80, dur: 16 }, // G4 (quarter)
    ]);

    // Measure 3 (F#4, E4, C5): ticks 96..144
    const m3Notes = sopranoNotes.filter((n) => n.startTick >= 96 && n.startTick < 144);
    expect(m3Notes.map((n) => ({ pitch: n.midiPitch, start: n.startTick, dur: n.durationTicks }))).toEqual([
      { pitch: 66, start: 96, dur: 16 },  // F#4 (quarter, t₁)
      { pitch: 64, start: 112, dur: 16 }, // E4 (quarter, l₁)
      { pitch: 72, start: 128, dur: 16 }, // C5 (quarter, f)
    ]);

    // Measure 4 (B4, G4, F#4): ticks 144..192
    const m4Notes = sopranoNotes.filter((n) => n.startTick >= 144 && n.startTick < 192);
    expect(m4Notes.map((n) => ({ pitch: n.midiPitch, start: n.startTick, dur: n.durationTicks }))).toEqual([
      { pitch: 71, start: 144, dur: 16 }, // B4 (quarter, m)
      { pitch: 67, start: 160, dur: 16 }, // G4 (quarter, d)
      { pitch: 66, start: 176, dur: 16 }, // F#4 (quarter, t₁)
    ]);

    // Measure 5 (G4): ticks 192..224
    const m5Notes = sopranoNotes.filter((n) => n.startTick >= 192 && n.startTick < 240);
    expect(m5Notes.map((n) => ({ pitch: n.midiPitch, start: n.startTick, dur: n.durationTicks }))).toEqual([
      { pitch: 67, start: 192, dur: 32 }, // G4 (half note, d)
    ]);
  });
});



