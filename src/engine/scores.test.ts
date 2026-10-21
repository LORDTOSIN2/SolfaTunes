import { describe, expect, it } from 'vitest';
import { getScoreDisplayTitle, SCORES } from '../utils/scores';
import { AbcParser } from './abc_parser';
import { SolfaTransformer } from './solfa_transformer';

describe('score library', () => {
  it('discovers repository scores and displays hymn names by default', () => {
    const franconia = SCORES.find(score => score.fileName === 'Franconia.txt');
    const vienna = SCORES.find(score => score.fileName === 'Vienna.txt');

    if (!franconia || !vienna) {
      throw new Error('The Franconia and Vienna scores must be present in the library.');
    }

    expect(getScoreDisplayTitle(franconia, 'hymn')).toBe('The advent of our King');
    expect(getScoreDisplayTitle(vienna, 'hymn')).toBe('Lucis Creator optime');
    expect(getScoreDisplayTitle(franconia, 'tune')).toBe('Franconia');
    expect(getScoreDisplayTitle(vienna, 'tune')).toBe('Vienna');
  });

  it('falls back to the score title when a hymn or tune title is missing', () => {
    const score = {
      id: 'untitled',
      fileName: 'untitled.abc',
      title: 'Untitled score',
      composer: 'Composer unknown',
      abcText: '',
    };

    expect(getScoreDisplayTitle(score, 'hymn')).toBe('Untitled score');
    expect(getScoreDisplayTitle(score, 'tune')).toBe('Untitled score');
  });

  it.each(SCORES)('parses and transforms $title', libraryItem => {
    const { score, warnings } = new AbcParser().parse(libraryItem.abcText);

    expect(warnings).toEqual([]);
    const titleHeader = libraryItem.abcText.match(/^T:(.*)$/m)?.[1];
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
