import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../utils/examples';
import { AbcParser } from './abc_parser';
import { SolfaTransformer } from './solfa_transformer';

describe('built-in score examples', () => {
  it.each(EXAMPLES)('parses and transforms $title', example => {
    const { score, warnings } = new AbcParser().parse(example.abcText);

    expect(warnings).toEqual([]);
    const titleHeader = example.abcText.match(/^T:(.*)$/m)?.[1];
    expect(titleHeader).toBeDefined();
    expect(score.title).toBe(titleHeader);
    expect(score.systems.length).toBeGreaterThan(0);

    new SolfaTransformer().transform(score);

    const notes = score.systems.flatMap(system =>
      Object.values(system.voices).flatMap(voice =>
        voice.measures.flatMap(measure => measure.notes)
      )
    );

    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      expect(Number.isInteger(note.durationTicks)).toBe(true);
      expect(note.durationTicks).toBeGreaterThan(0);
      expect(Number.isInteger(note.timestamp)).toBe(true);
      expect(Number.isFinite(note.midiPitch)).toBe(true);
      if (!note.isRest) {
        expect(note.syllable).not.toBe('');
      }
    }
  });
});
