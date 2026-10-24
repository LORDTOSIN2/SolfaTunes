import { describe, expect, it } from 'vitest';
import { AbcParser } from './abc_parser';
import { formatSolfaSyllable, pulseTicks, SolfaTransformer } from './solfa_transformer';

function transformAbc(body: string, headers = '') {
  const abc = [
    'X:1',
    'M:4/4',
    'L:1/4',
    'K:C',
    headers,
    '',
    body,
  ].filter(Boolean).join('\n');
  const { score } = new AbcParser().parse(abc);
  return new SolfaTransformer().transform(score);
}

describe('SolfaTransformer', () => {
  it('resolves pitches, applies accidentals within a measure, and resets them at barlines', () => {
    const score = transformAbc('[V:1] C ^F F | F |');
    const voice = score.systems[0].voices['1'];

    expect(voice.measures[0].notes.map(note => note.syllable)).toEqual(['d', 'fi', 'fi']);
    expect(voice.measures[0].notes.map(note => note.midiPitch)).toEqual([60, 66, 66]);
    expect(voice.measures[1].notes[0]).toMatchObject({
      syllable: 'f',
      midiPitch: 65,
      timestamp: 48,
    });
  });

  it('scales durations and preserves pitches, rests, and playback timestamps', () => {
    const score = transformAbc(
      '[V:1] C2 z |',
      'L:1/8',
    );
    const notes = score.systems[0].voices['1'].measures[0].notes;

    expect(notes.map(note => note.durationTicks)).toEqual([16, 8]);
    expect(notes[0]).toMatchObject({ syllable: 'd', midiPitch: 60, timestamp: 0 });
    expect(notes[1]).toMatchObject({
      isRest: true,
      syllable: '·',
      midiPitch: 0,
      timestamp: 16,
    });
  });

  it('aligns playback timestamps across voices with different note groupings', () => {
    const score = transformAbc(
      '[V:1] C D |\n[V:2] C2 |',
      'V:1 name="Soprano" clef=treble\nV:2 name="Bass" clef=bass',
    );
    const voices = score.systems[0].voices;

    expect(voices['1'].measures[0].notes.map(note => note.timestamp)).toEqual([0, 16]);
    expect(voices['2'].measures[0].notes[0]).toMatchObject({
      timestamp: 0,
      durationTicks: 32,
    });
  });
});

describe('Solfa formatting helpers', () => {
  it.each([
    ['3/4', 16],
    ['6/8', 24],
    ['9/8', 24],
    ['12/8', 24],
  ])('calculates pulse ticks for %s meter', (meter, expectedTicks) => {
    expect(pulseTicks(meter)).toBe(expectedTicks);
  });

  it('adds and caps octave dots without losing multi-character syllables', () => {
    expect(formatSolfaSyllable('fi', 1)).toBe('f\u0307i');
    expect(formatSolfaSyllable('d', 3)).toBe('d\u0307\u0307');
    expect(formatSolfaSyllable('r', -1)).toBe('r\u0323');
    expect(formatSolfaSyllable('m', 0)).toBe('m');
  });
});
