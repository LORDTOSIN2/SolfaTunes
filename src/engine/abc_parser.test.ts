import { describe, expect, it } from 'vitest';
import { AbcParser, parseDurationMultiplier, tokenizeMusicLine } from './abc_parser';

describe('ABC tokenization and durations', () => {
  it('recognizes inline voices, accidentals, octave marks, durations, and barlines', () => {
    const tokens = tokenizeMusicLine("[V:1] ^F/2 G,2 |: z :|");

    expect(tokens.filter(token => token.type !== 'whitespace')).toEqual([
      { type: 'voice', value: '1' },
      { type: 'note', value: '^F/2' },
      { type: 'note', value: 'G,2' },
      { type: 'bar', value: '|:' },
      { type: 'note', value: 'z' },
      { type: 'bar', value: ':|' },
    ]);
  });

  it.each([
    ['', 1],
    ['2', 2],
    ['/', 0.5],
    ['/4', 0.25],
    ['3/2', 1.5],
  ])('parses ABC duration %s as %s', (duration, expected) => {
    expect(parseDurationMultiplier(duration)).toBe(expected);
  });
});

describe('AbcParser', () => {
  it('parses headers, voice declarations, notes, rests, and measure boundaries', () => {
    const { score, warnings } = new AbcParser().parse([
      'X:7',
      'T:Scale',
      'C:Composer',
      'M:3/4',
      'L:1/8',
      'K:G',
      'V:1 name="Soprano" clef=treble',
      '',
      '[V:1] G A B | c2 z |',
      'W:Scale lyrics',
    ].join('\n'));

    expect(warnings).toEqual([]);
    expect(score).toMatchObject({
      index: '7',
      title: 'Scale',
      composer: 'Composer',
      meter: '3/4',
      defaultLength: '1/8',
      key: 'G',
      lyrics: ['Scale lyrics'],
    });
    expect(score.voices).toContainEqual({
      id: '1',
      name: 'Soprano',
      clef: 'treble',
      order: 0,
    });

    const voice = score.systems[0].voices['1'];
    expect(voice.measures).toHaveLength(2);
    expect(voice.measures[0].notes.map(note => note.rawLetter)).toEqual(['G', 'A', 'B']);
    expect(voice.measures[1].notes.map(note => note.isRest)).toEqual([false, true]);
    expect(voice.measures[1].notes.map(note => note.durationTicks)).toEqual([2, 1]);
  });

  it('resets parser state when the same parser instance parses another score', () => {
    const parser = new AbcParser();
    parser.parse('T:First\nK:G\n\nG |');

    const { score } = parser.parse('T:Second\n\nC |');

    expect(score.title).toBe('Second');
    expect(score.key).toBe('C');
    expect(score.systems[0].voices['1'].measures[0].notes[0].rawLetter).toBe('C');
  });
});
