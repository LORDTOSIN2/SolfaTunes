import { describe, expect, it } from 'vitest';
import { parseSolfaToAbc, midiToAbcNote, solfaNoteToMidi } from './solfa_parser';

describe('Solfa and MIDI pitch conversion', () => {
  it('maps tonic and scale degrees in soprano and lower-voice registers', () => {
    expect(solfaNoteToMidi('d', 'C', 'soprano')).toBe(60);
    expect(solfaNoteToMidi('s', 'C', 'soprano')).toBe(67);
    expect(solfaNoteToMidi('d', 'C', 'tenor')).toBe(48);
    expect(solfaNoteToMidi('d¹', 'C', 'soprano')).toBe(72);
    expect(solfaNoteToMidi('d₁', 'C', 'soprano')).toBe(48);
  });

  it('uses the selected key tonic and recognizes common syllable aliases', () => {
    expect(solfaNoteToMidi('d', 'Bb', 'soprano')).toBe(70);
    expect(solfaNoteToMidi('ra', 'C', 'soprano')).toBe(solfaNoteToMidi('di', 'C', 'soprano'));
    expect(solfaNoteToMidi('ma', 'C', 'soprano')).toBe(solfaNoteToMidi('ri', 'C', 'soprano'));
    expect(solfaNoteToMidi('ta', 'C', 'soprano')).toBe(solfaNoteToMidi('li', 'C', 'soprano'));
  });

  it('spells MIDI pitches with key-aware accidentals and ABC octave marks', () => {
    expect(midiToAbcNote(60, 'C')).toBe('C');
    expect(midiToAbcNote(61, 'C')).toBe('^C');
    expect(midiToAbcNote(66, 'G')).toBe('F');
    expect(midiToAbcNote(72, 'C')).toBe('c');
    expect(midiToAbcNote(48, 'C')).toBe('C,');
  });
});

describe('parseSolfaToAbc', () => {
  it('converts a melody and preserves its key, meter, title, and lyrics', () => {
    const { abcText, warnings } = parseSolfaToAbc([
      'KEY C   Major Scale   Composer   M:4/4',
      'S: d : r : m : f |',
      'W: Do re mi fa',
    ].join('\n'));

    expect(warnings).toEqual([]);
    expect(abcText).toContain('T:Major Scale');
    expect(abcText).toContain('C:Composer');
    expect(abcText).toContain('M:4/4');
    expect(abcText).toContain('K:C');
    expect(abcText).toContain('[V:1] C D E F |');
    expect(abcText).toContain('W: Do re mi fa');
  });

  it('creates descant voice declarations and preserves metadata comments', () => {
    const { abcText } = parseSolfaToAbc([
      'KEY G',
      '% has_descant=true',
      '% verses=3',
      'D: s : l : t : d¹ |',
      'S: d : r : m : f |',
    ].join('\n'));

    expect(abcText).toContain('%%staves [(5) (1 2) (3 4)]');
    expect(abcText).toContain('V:5 name="Descant" clef=treble');
    expect(abcText).toContain('% verses=3');
    expect(abcText).toContain('[V:5]');
    expect(abcText).toContain('[V:1]');
  });
});
