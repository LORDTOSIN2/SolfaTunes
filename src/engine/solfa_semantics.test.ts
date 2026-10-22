/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  SOLFA_SYLLABLES,
  KEYS,
  getKeyInfo,
  getKeyDefaultAccidentals,
  basePitchClass,
  calculatePitchClass,
  calculateScaleDegree,
  scaleDegreeToSyllable,
  pitchClassToSolfaSyllable,
  calculateMidiPitch,
  calculateSolfaOctave,
  resolveNoteSemantics,
  areEnharmonicallyEquivalent,
  normalizeKey,
} from './solfa_semantics';

describe('SolfaSemantics (Phase 2)', () => {
  describe('1. All 12 Chromatic Degrees', () => {
    it('maps all 12 scale degrees 0-11 to exact Tonic Sol-fa syllables', () => {
      const expectedSyllables = [
        'd',  // 0: Do
        'di', // 1: Di (raised tonic / lowered supertonic)
        'r',  // 2: Re
        'ri', // 3: Ri (raised supertonic / lowered mediant)
        'm',  // 4: Mi
        'f',  // 5: Fa
        'fi', // 6: Fi (raised subdominant / tritone)
        's',  // 7: So
        'si', // 8: Si (raised dominant / lowered submediant)
        'l',  // 9: La
        'li', // 10: Li (raised submediant / lowered subtonic)
        't',  // 11: Ti
      ];

      expect(SOLFA_SYLLABLES).toEqual(expectedSyllables);

      for (let degree = 0; degree < 12; degree++) {
        expect(scaleDegreeToSyllable(degree)).toBe(expectedSyllables[degree]);
      }
    });

    it('resolves all 12 chromatic semitones in Key of C (tonic=0)', () => {
      const tonic = 0; // C
      const chromaticPitches = [
        { pc: 0, expectedDeg: 0, expectedSyllable: 'd' },
        { pc: 1, expectedDeg: 1, expectedSyllable: 'di' },
        { pc: 2, expectedDeg: 2, expectedSyllable: 'r' },
        { pc: 3, expectedDeg: 3, expectedSyllable: 'ri' },
        { pc: 4, expectedDeg: 4, expectedSyllable: 'm' },
        { pc: 5, expectedDeg: 5, expectedSyllable: 'f' },
        { pc: 6, expectedDeg: 6, expectedSyllable: 'fi' },
        { pc: 7, expectedDeg: 7, expectedSyllable: 's' },
        { pc: 8, expectedDeg: 8, expectedSyllable: 'si' },
        { pc: 9, expectedDeg: 9, expectedSyllable: 'l' },
        { pc: 10, expectedDeg: 10, expectedSyllable: 'li' },
        { pc: 11, expectedDeg: 11, expectedSyllable: 't' },
      ];

      for (const item of chromaticPitches) {
        const deg = calculateScaleDegree(item.pc, tonic);
        expect(deg).toBe(item.expectedDeg);
        expect(scaleDegreeToSyllable(deg)).toBe(item.expectedSyllable);
        expect(pitchClassToSolfaSyllable(item.pc, tonic)).toBe(item.expectedSyllable);
      }
    });
  });

  describe('2. Every Key in the Hymn Collection', () => {
    // Hymn 1: Winchester New -> Key of C (0 sharps/flats, tonic C=0)
    it('evaluates Winchester New (Key C)', () => {
      const keyInfo = getKeyInfo('C');
      expect(keyInfo.tonic).toBe(0);
      expect(keyInfo.sharpsFlats).toBe(0);

      const defaultAccs = getKeyDefaultAccidentals(keyInfo.sharpsFlats);
      const diatonicNotes = [
        { letter: 'C', expectedDeg: 0, expectedSyl: 'd' },
        { letter: 'D', expectedDeg: 2, expectedSyl: 'r' },
        { letter: 'E', expectedDeg: 4, expectedSyl: 'm' },
        { letter: 'F', expectedDeg: 5, expectedSyl: 'f' },
        { letter: 'G', expectedDeg: 7, expectedSyl: 's' },
        { letter: 'A', expectedDeg: 9, expectedSyl: 'l' },
        { letter: 'B', expectedDeg: 11, expectedSyl: 't' },
      ];

      for (const note of diatonicNotes) {
        const res = resolveNoteSemantics({
          rawLetter: note.letter,
          activeOverrides: {},
          keyInfo,
          keyDefaultAccs: defaultAccs,
        });
        expect(res.scaleDegree).toBe(note.expectedDeg);
        expect(res.syllable).toBe(note.expectedSyl);
      }
    });

    // Hymn 2: Vienna -> Key of G (1 sharp F#, tonic G=7)
    it('evaluates Vienna (Key G)', () => {
      const keyInfo = getKeyInfo('G');
      expect(keyInfo.tonic).toBe(7);
      expect(keyInfo.sharpsFlats).toBe(1);

      const defaultAccs = getKeyDefaultAccidentals(keyInfo.sharpsFlats);
      expect(defaultAccs['F']).toBe(1); // F# automatically applied

      const diatonicNotes = [
        { letter: 'G', expectedDeg: 0, expectedSyl: 'd' },
        { letter: 'A', expectedDeg: 2, expectedSyl: 'r' },
        { letter: 'B', expectedDeg: 4, expectedSyl: 'm' },
        { letter: 'C', expectedDeg: 5, expectedSyl: 'f' },
        { letter: 'D', expectedDeg: 7, expectedSyl: 's' },
        { letter: 'E', expectedDeg: 9, expectedSyl: 'l' },
        { letter: 'F', expectedDeg: 11, expectedSyl: 't' }, // F gets +1 from key = F# = leading tone
      ];

      for (const note of diatonicNotes) {
        const res = resolveNoteSemantics({
          rawLetter: note.letter,
          activeOverrides: {},
          keyInfo,
          keyDefaultAccs: defaultAccs,
        });
        expect(res.scaleDegree).toBe(note.expectedDeg);
        expect(res.syllable).toBe(note.expectedSyl);
      }
    });

    // Hymn 3: Franconia -> Key of Eb (3 flats Bb, Eb, Ab, tonic Eb=3)
    it('evaluates Franconia (Key Eb)', () => {
      const keyInfo = getKeyInfo('Eb');
      expect(keyInfo.tonic).toBe(3);
      expect(keyInfo.sharpsFlats).toBe(-3);

      const defaultAccs = getKeyDefaultAccidentals(keyInfo.sharpsFlats);
      expect(defaultAccs['B']).toBe(-1); // Bb
      expect(defaultAccs['E']).toBe(-1); // Eb
      expect(defaultAccs['A']).toBe(-1); // Ab

      const diatonicNotes = [
        { letter: 'E', expectedDeg: 0, expectedSyl: 'd' }, // Eb = tonic
        { letter: 'F', expectedDeg: 2, expectedSyl: 'r' }, // F
        { letter: 'G', expectedDeg: 4, expectedSyl: 'm' }, // G
        { letter: 'A', expectedDeg: 5, expectedSyl: 'f' }, // Ab
        { letter: 'B', expectedDeg: 7, expectedSyl: 's' }, // Bb
        { letter: 'C', expectedDeg: 9, expectedSyl: 'l' }, // C
        { letter: 'D', expectedDeg: 11, expectedSyl: 't' }, // D
      ];

      for (const note of diatonicNotes) {
        const res = resolveNoteSemantics({
          rawLetter: note.letter,
          activeOverrides: {},
          keyInfo,
          keyDefaultAccs: defaultAccs,
        });
        expect(res.scaleDegree).toBe(note.expectedDeg);
        expect(res.syllable).toBe(note.expectedSyl);
      }
    });
  });

  describe('3. Minor-Key Convention (Explicitly Documented Do-Based Minor)', () => {
    /**
     * SolfaTunes Choice: DO-BASED MINOR
     * In SolfaTunes, the tonic of any minor key is treated as degree 0 ('d').
     * Key signature accidentals are inherited from the relative major.
     */
    it('normalizes minor key designations properly', () => {
      expect(normalizeKey('Am')).toBe('AM');
      expect(normalizeKey('A minor')).toBe('AM');
      expect(normalizeKey('Amin')).toBe('AM');
      expect(normalizeKey('G#m')).toBe('G#M');
      expect(normalizeKey('Dm')).toBe('DM');
      expect(normalizeKey('Cm')).toBe('CM');
    });

    it('evaluates A minor (AM) in Do-based minor convention', () => {
      const keyInfo = getKeyInfo('Am');
      expect(keyInfo.tonic).toBe(9); // Tonic is A (pitch class 9)
      expect(keyInfo.sharpsFlats).toBe(0); // 0 sharps/flats (relative major C)

      const defaultAccs = getKeyDefaultAccidentals(keyInfo.sharpsFlats);

      // Natural minor notes in A minor
      const naturalMinor = [
        { letter: 'A', acc: undefined, deg: 0, syl: 'd' },   // Tonic = do
        { letter: 'B', acc: undefined, deg: 2, syl: 'r' },   // Major 2nd = re
        { letter: 'C', acc: undefined, deg: 3, syl: 'ri' },  // Minor 3rd = ri
        { letter: 'D', acc: undefined, deg: 5, syl: 'f' },   // Perfect 4th = fa
        { letter: 'E', acc: undefined, deg: 7, syl: 's' },   // Perfect 5th = so
        { letter: 'F', acc: undefined, deg: 8, syl: 'si' },  // Minor 6th = si
        { letter: 'G', acc: undefined, deg: 10, syl: 'li' }, // Minor 7th = li
        { letter: 'G', acc: '^', deg: 11, syl: 't' },        // Leading tone (G# in harmonic minor) = ti
      ];

      for (const item of naturalMinor) {
        const res = resolveNoteSemantics({
          rawLetter: item.letter,
          rawAccidental: item.acc,
          activeOverrides: {},
          keyInfo,
          keyDefaultAccs: defaultAccs,
        });
        expect(res.scaleDegree).toBe(item.deg);
        expect(res.syllable).toBe(item.syl);
      }
    });

    it('evaluates D minor (DM) in Do-based minor convention', () => {
      const keyInfo = getKeyInfo('Dm');
      expect(keyInfo.tonic).toBe(2); // Tonic is D (pitch class 2)
      expect(keyInfo.sharpsFlats).toBe(-1); // 1 flat Bb (relative major F)

      const defaultAccs = getKeyDefaultAccidentals(keyInfo.sharpsFlats);
      expect(defaultAccs['B']).toBe(-1); // Bb

      const dMinorNotes = [
        { letter: 'D', acc: undefined, deg: 0, syl: 'd' },   // D = do
        { letter: 'E', acc: undefined, deg: 2, syl: 'r' },   // E = re
        { letter: 'F', acc: undefined, deg: 3, syl: 'ri' },  // F = ri (minor 3rd)
        { letter: 'G', acc: undefined, deg: 5, syl: 'f' },   // G = fa
        { letter: 'A', acc: undefined, deg: 7, syl: 's' },   // A = so
        { letter: 'B', acc: undefined, deg: 8, syl: 'si' },  // Bb = si (minor 6th)
        { letter: 'C', acc: undefined, deg: 10, syl: 'li' }, // C = li (minor 7th)
        { letter: 'C', acc: '^', deg: 11, syl: 't' },        // C# = ti (harmonic minor leading tone)
      ];

      for (const item of dMinorNotes) {
        const res = resolveNoteSemantics({
          rawLetter: item.letter,
          rawAccidental: item.acc,
          activeOverrides: {},
          keyInfo,
          keyDefaultAccs: defaultAccs,
        });
        expect(res.scaleDegree).toBe(item.deg);
        expect(res.syllable).toBe(item.syl);
      }
    });
  });

  describe('4. Enharmonic Spellings', () => {
    it('correctly maps enharmonically equivalent notes to identical pitch classes and syllables', () => {
      const tonic = 0; // Key of C
      const pairs: Array<{
        noteA: { letter: string; acc: string };
        noteB: { letter: string; acc: string };
        expectedPitchClass: number;
        expectedSyllable: string;
      }> = [
        { noteA: { letter: 'C', acc: '^' }, noteB: { letter: 'D', acc: '_' }, expectedPitchClass: 1, expectedSyllable: 'di' },
        { noteA: { letter: 'D', acc: '^' }, noteB: { letter: 'E', acc: '_' }, expectedPitchClass: 3, expectedSyllable: 'ri' },
        { noteA: { letter: 'F', acc: '^' }, noteB: { letter: 'G', acc: '_' }, expectedPitchClass: 6, expectedSyllable: 'fi' },
        { noteA: { letter: 'G', acc: '^' }, noteB: { letter: 'A', acc: '_' }, expectedPitchClass: 8, expectedSyllable: 'si' },
        { noteA: { letter: 'A', acc: '^' }, noteB: { letter: 'B', acc: '_' }, expectedPitchClass: 10, expectedSyllable: 'li' },
        { noteA: { letter: 'E', acc: '^' }, noteB: { letter: 'F', acc: '=' }, expectedPitchClass: 5, expectedSyllable: 'f' },
        { noteA: { letter: 'B', acc: '^' }, noteB: { letter: 'C', acc: '=' }, expectedPitchClass: 0, expectedSyllable: 'd' },
        { noteA: { letter: 'C', acc: '_' }, noteB: { letter: 'B', acc: '=' }, expectedPitchClass: 11, expectedSyllable: 't' },
        { noteA: { letter: 'F', acc: '_' }, noteB: { letter: 'E', acc: '=' }, expectedPitchClass: 4, expectedSyllable: 'm' },
      ];

      for (const pair of pairs) {
        expect(areEnharmonicallyEquivalent(pair.noteA, pair.noteB)).toBe(true);

        const pcA = calculatePitchClass(pair.noteA.letter, pair.noteA.acc === '^' ? 1 : pair.noteA.acc === '_' ? -1 : 0);
        const pcB = calculatePitchClass(pair.noteB.letter, pair.noteB.acc === '^' ? 1 : pair.noteB.acc === '_' ? -1 : 0);

        expect(pcA).toBe(pair.expectedPitchClass);
        expect(pcB).toBe(pair.expectedPitchClass);

        const sylA = pitchClassToSolfaSyllable(pcA, tonic);
        const sylB = pitchClassToSolfaSyllable(pcB, tonic);

        expect(sylA).toBe(pair.expectedSyllable);
        expect(sylB).toBe(pair.expectedSyllable);
      }
    });
  });

  describe('5. Transposition Property Test (Identical Sol-fa Sequence Across Keys)', () => {
    it('produces identical major scale sol-fa sequence across all 15 major keys', () => {
      const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11, 12];
      const expectedSyllables = ['d', 'r', 'm', 'f', 's', 'l', 't', 'd'];

      const allMajorKeys = [
        'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
        'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'
      ];

      for (const keyName of allMajorKeys) {
        const keyInfo = getKeyInfo(keyName);
        const generatedSyllables: string[] = [];

        for (const interval of majorScaleIntervals) {
          const soundingPitchClass = (keyInfo.tonic + interval) % 12;
          const deg = calculateScaleDegree(soundingPitchClass, keyInfo.tonic);
          generatedSyllables.push(scaleDegreeToSyllable(deg));
        }

        expect(generatedSyllables).toEqual(expectedSyllables);
      }
    });

    it('produces identical chromatic motif sol-fa sequence when transposed to different keys', () => {
      // Motif: [d, di, r, ri, m, fi, s] -> intervals [0, 1, 2, 3, 4, 6, 7]
      const motifIntervals = [0, 1, 2, 3, 4, 6, 7];
      const expectedMotif = ['d', 'di', 'r', 'ri', 'm', 'fi', 's'];

      const testKeys = ['C', 'G', 'Eb', 'D', 'F', 'Ab'];

      for (const keyName of testKeys) {
        const keyInfo = getKeyInfo(keyName);
        const motifSyllables: string[] = [];

        for (const interval of motifIntervals) {
          const pitchClass = (keyInfo.tonic + interval) % 12;
          const deg = calculateScaleDegree(pitchClass, keyInfo.tonic);
          motifSyllables.push(scaleDegreeToSyllable(deg));
        }

        expect(motifSyllables).toEqual(expectedMotif);
      }
    });
  });
});
