import { describe, expect, it } from 'vitest';
import {
  createAbcScoreLibraryItem,
  getScoreDisplayTitle,
  SCORES,
} from '../utils/scores';
import { AbcParser } from './abc_parser';
import { SolfaTransformer } from './solfa_transformer';
import { MusicXmlParser } from './musicxml/musicxml_parser';
import { getScoreMeasureRanges } from '../utils/playback_timeline';

const scoreFiles = import.meta.glob<string>('../../test/fixtures/scores/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const scoreFixtures = Object.entries(scoreFiles).map(([path, abcText]) =>
  createAbcScoreLibraryItem(path, abcText)
);

describe('score fixtures', () => {
  it('bundles repository MusicXML projects into the unified score library', async () => {
    const musicXmlScores = SCORES.filter(score => score.format === 'musicxml');

    expect(musicXmlScores.map(score => score.fileName).sort()).toEqual([
      '1 - illsley_second_tune.musicxml',
      '2 - winchester_new .musicxml',
      'external MuseScore SATB 1.xml',
      'external Stuttgart-Come_Thou Key G.xml',
      'franconia .musicxml',
      'morning .musicxml',
      'vienna .musicxml',
    ]);
    for (const score of musicXmlScores) {
      const xmlText = await score.loadXml();
      expect(xmlText).toContain('<score-partwise');
      expect(() => MusicXmlParser.parse(xmlText)).not.toThrow();
    }
  });

  it('loads test fixtures and displays hymn names by default', () => {
    const franconia = scoreFixtures.find(score => score.fileName === 'Franconia.txt');
    const vienna = scoreFixtures.find(score => score.fileName === 'Vienna.txt');
    const winchester = scoreFixtures.find(score => score.fileName === 'Winchester New.txt');

    expect(franconia).toBeDefined();
    expect(vienna).toBeDefined();
    expect(winchester).toBeDefined();
    if (!franconia || !vienna || !winchester) return;

    expect(getScoreDisplayTitle(franconia, 'hymn')).toBe('The advent of our King');
    expect(getScoreDisplayTitle(vienna, 'hymn')).toBe('Lucis Creator optime');
    expect(getScoreDisplayTitle(winchester, 'hymn')).toBe("On Jordan's bank the Baptist's cry");
    expect(getScoreDisplayTitle(franconia, 'tune')).toBe('Franconia');
    expect(getScoreDisplayTitle(vienna, 'tune')).toBe('Vienna');
    expect(getScoreDisplayTitle(winchester, 'tune')).toBe('Winchester New');
  });

  it('falls back to the score title when a hymn or tune title is missing', () => {
    const score = {
      id: 'untitled',
      fileName: 'untitled.abc',
      format: 'abc' as const,
      title: 'Untitled score',
      composer: 'Composer unknown',
      abcText: '',
    };

    expect(getScoreDisplayTitle(score, 'hymn')).toBe('Untitled score');
    expect(getScoreDisplayTitle(score, 'tune')).toBe('Untitled score');
  });

  it.each(scoreFixtures)('parses and transforms $title', fixture => {
    const { score, warnings } = new AbcParser().parse(fixture.abcText);

    expect(warnings).toEqual([]);
    const titleHeader = fixture.abcText.match(/^T:(.*)$/m)?.[1];
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

  it.each(scoreFixtures)('keeps the visual measure timeline aligned with audio note timestamps for $title', fixture => {
    const { score } = new AbcParser().parse(fixture.abcText);
    new SolfaTransformer().transform(score);

    const ranges = getScoreMeasureRanges(score);
    const expectedMeasureCount = score.systems.reduce((count, system) => {
      return count + Math.max(
        0,
        ...score.voices.map(voice => system.voices[voice.id]?.measures.length || 0)
      );
    }, 0);

    expect(ranges).toHaveLength(expectedMeasureCount);

    ranges.forEach(range => {
      const measureNotes = score.voices.flatMap(voice =>
        score.systems.find(system => system.systemIndex === range.systemIndex)
          ?.voices[voice.id]?.measures[range.measureIndex]?.notes || []
      );

      if (measureNotes.length > 0) {
        expect(Math.min(...measureNotes.map(note => note.timestamp))).toBe(range.start);
        expect(Math.max(...measureNotes.map(note => note.timestamp + note.durationTicks))).toBe(range.end);
      }
    });
  });

  it('populates hymn meters for standard hymn scores and extracts meters from comments or tune lookup', () => {
    const scoresWithMeters = SCORES.filter(s => !!s.hymnMeter);
    expect(scoresWithMeters.length).toBeGreaterThan(0);

    const franconiaScore = SCORES.find(s => s.tuneName?.toLowerCase().includes('franconia') || s.title.toLowerCase().includes('franconia'));
    expect(franconiaScore?.hymnMeter).toBe('8.6.8.6');

    const viennaScore = SCORES.find(s => s.tuneName?.toLowerCase().includes('vienna') || s.title.toLowerCase().includes('vienna'));
    expect(viennaScore?.hymnMeter).toBe('7.7.7.7');

    const stuttgartScore = SCORES.find(s => s.fileName.toLowerCase().includes('stuttgart'));
    expect(stuttgartScore?.hymnMeter).toBe('8.7.8.7');
  });
});

