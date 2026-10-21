import { describe, expect, it } from 'vitest';
import { AbcParser } from './abc_parser';
import { serializeScoreToAbc } from './abc_serializer';
import { SolfaTransformer } from './solfa_transformer';

describe('ABC serialization', () => {
  it('round-trips note pitches, accidentals, octaves, durations, and score metadata', () => {
    const source = [
      'X:2',
      'T:Round trip',
      'C:Test composer',
      'M:4/4',
      'L:1/8',
      'K:G',
      'V:1 name="Soprano" clef=treble',
      '',
      '[V:1] ^F2 F z/2 c\' |',
    ].join('\n');
    const original = new AbcParser().parse(source).score;
    new SolfaTransformer().transform(original);

    const serialized = serializeScoreToAbc(original);
    const reparsed = new AbcParser().parse(serialized).score;
    new SolfaTransformer().transform(reparsed);

    expect(reparsed).toMatchObject({
      index: '2',
      title: 'Round trip',
      composer: 'Test composer',
      meter: '4/4',
      defaultLength: '1/8',
      key: 'G',
    });

    const originalNotes = original.systems[0].voices['1'].measures[0].notes;
    const reparsedNotes = reparsed.systems[0].voices['1'].measures[0].notes;
    expect(reparsedNotes.map(note => [
      note.rawLetter,
      note.rawAccidental,
      note.octaveNum,
      note.durationTicks,
      note.isRest,
    ])).toEqual(originalNotes.map(note => [
      note.rawLetter,
      note.rawAccidental,
      note.octaveNum,
      note.durationTicks,
      note.isRest,
    ]));
  });
});
