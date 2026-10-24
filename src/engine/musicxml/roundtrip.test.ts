/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AbcParser } from '../abc_parser';
import { SolfaTransformer } from '../solfa_transformer';
import { serializeScoreToAbc } from '../abc_serializer';
import { MusicXmlSerializer, serializeScoreToMusicXml } from './musicxml_serializer';
import { MusicXmlParser, parseMusicXmlToScore, MusicXmlParseError } from './musicxml_parser';
import { ParsedScore } from '../../types';
import { formatLossinessReport } from './lossiness_report';

interface MidiNoteEvent {
  voiceId: string;
  midiPitch: number;
  timestamp: number;
  durationTicks: number;
}

function extractMidiEvents(score: ParsedScore): MidiNoteEvent[] {
  const events: MidiNoteEvent[] = [];
  score.systems.forEach((system) => {
    score.voices.forEach((voice) => {
      const vLine = system.voices[voice.id];
      if (!vLine) return;
      vLine.measures.forEach((measure) => {
        measure.notes.forEach((note) => {
          if (!note.isRest) {
            events.push({
              voiceId: voice.id,
              midiPitch: note.midiPitch,
              timestamp: note.timestamp,
              durationTicks: note.durationTicks,
            });
          }
        });
      });
    });
  });
  return events;
}

function loadHymnAbc(fileName: string): string {
  const filePath = path.resolve(__dirname, '../../../test/fixtures/scores', fileName);
  return fs.readFileSync(filePath, 'utf-8');
}

describe('MusicXML Phase 3 Conversion & Round-Trip', () => {
  const hymns = [
    { name: 'Franconia', file: 'Franconia.txt', expectedKey: 'Eb', fifths: -3 },
    { name: 'Vienna', file: 'Vienna.txt', expectedKey: 'G', fifths: 1 },
    { name: 'Winchester New', file: 'Winchester New.txt', expectedKey: 'C', fifths: 0 },
  ];

  describe('(1) Structure & Part Mapping', () => {
    it('exports exactly one MusicXML part per voice and verifies part names', () => {
      const abc = loadHymnAbc('Winchester New.txt');
      const parser = new AbcParser();
      const initialScore = new SolfaTransformer().transform(parser.parse(abc).score);

      const { xml, report } = serializeScoreToMusicXml(initialScore);
      expect(report.isLossless).toBe(true);

      expect(xml).toContain('<score-part id="P1">');
      expect(xml).toContain('<part-name>Soprano</part-name>');
      expect(xml).toContain('<score-part id="P2">');
      expect(xml).toContain('<part-name>Alto</part-name>');
      expect(xml).toContain('<score-part id="P3">');
      expect(xml).toContain('<part-name>Tenor</part-name>');
      expect(xml).toContain('<score-part id="P4">');
      expect(xml).toContain('<part-name>Bass</part-name>');

      // Verify each part tag exists
      expect(xml).toContain('<part id="P1">');
      expect(xml).toContain('<part id="P2">');
      expect(xml).toContain('<part id="P3">');
      expect(xml).toContain('<part id="P4">');
    });

    it('emits explicit warnings when importing multi-voice staves and backup tags', () => {
      const multiVoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Staff 1</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>4</duration>
        <voice>1</voice>
      </note>
      <backup>
        <duration>4</duration>
      </backup>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <voice>2</voice>
      </note>
    </measure>
  </part>
</score-partwise>`;

      const result = parseMusicXmlToScore(multiVoiceXml);
      expect(result.report.isLossless).toBe(false);
      expect(result.report.unsupportedConstructs).toContain('Polyphonic <backup> elements');
      expect(result.report.unsupportedConstructs).toContain('Multi-voice staves');
      expect(result.report.warnings.some((w) => w.includes('<backup>'))).toBe(true);
      expect(result.report.warnings.some((w) => w.includes('multiple voice numbers'))).toBe(true);

      const formatted = formatLossinessReport(result.report);
      expect(formatted).toContain('Polyphonic <backup> elements');
      expect(formatted).toContain('Multi-voice staves');
    });
  });

  describe('(2) Explicit Sol-fa Syllable Preservation (Minor Keys & Overrides)', () => {
    it('preserves minor-key and chromatic syllables via noteOverrides with isExplicit=true', () => {
      const aMinorAbc = `X:1\nT:Minor Test\nM:4/4\nL:1/4\nK:Am\nV:1 clef=treble\n[V:1] A B c ^G |`;
      const initialScore = new SolfaTransformer().transform(new AbcParser().parse(aMinorAbc).score);

      // Note 0: A -> 'd'
      // Note 1: B -> 'r'
      // Note 2: c -> 'ri' (minor 3rd)
      // Note 3: ^G -> 't' (harmonic minor leading tone)
      const noteSyllables = initialScore.systems[0].voices['1'].measures[0].notes.map((n) => n.syllable);
      expect(noteSyllables).toEqual(['d', 'r', 'ri', 't']);

      const { xml } = serializeScoreToMusicXml(initialScore);

      // Verify that isExplicit=true is written in metadata
      expect(xml).toContain('isExplicit');
      expect(xml).toContain('&quot;syllable&quot;:&quot;ri&quot;');
      expect(xml).toContain('&quot;syllable&quot;:&quot;t&quot;');

      // Parse back from MusicXML
      const { score: parsedBack } = parseMusicXmlToScore(xml);
      const parsedSyllables = parsedBack.systems[0].voices['1'].measures[0].notes.map((n) => n.syllable);

      // Must NEVER silently re-derive or lose minor-key syllables
      expect(parsedSyllables).toEqual(['d', 'r', 'ri', 't']);
    });
  });

  describe('(3) Mid-Score Key Changes', () => {
    it('applies the initial key, preserves it, logs a warning and marks report lossy', () => {
      const midScoreKeyChangeXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Voice</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
      </note>
    </measure>
    <measure number="2">
      <attributes>
        <key><fifths>2</fifths><mode>major</mode></key>
      </attributes>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>4</duration>
      </note>
    </measure>
  </part>
</score-partwise>`;

      const result = parseMusicXmlToScore(midScoreKeyChangeXml);

      // Initial key preserved
      expect(result.score.key).toBe('C');
      expect(result.report.isLossless).toBe(false);
      expect(result.report.unsupportedConstructs).toContain('Mid-score key changes');
      expect(result.report.warnings.some((w) => w.includes('Mid-score key change detected at measure 2'))).toBe(true);

      const formatted = formatLossinessReport(result.report);
      expect(formatted).toContain('Mid-score key change detected at measure 2');
    });
  });

  describe('(4) & (5) Comprehensive Hymn Round-Trips & MIDI Event Comparison', () => {
    hymns.forEach(({ name, file, expectedKey, fifths }) => {
      it(`executes lossless round-trip for ${name} (${expectedKey})`, () => {
        const rawAbc = loadHymnAbc(file);
        const abcParser = new AbcParser();
        const score1 = new SolfaTransformer().transform(abcParser.parse(rawAbc).score);

        // Verify initial score parsing
        expect(score1.key).toBe(expectedKey);
        expect(score1.voices.length).toBe(4);

        // Export to MusicXML
        const { xml: xml1, report: exportReport } = serializeScoreToMusicXml(score1);
        expect(exportReport.isLossless).toBe(true);

        // Assert on XML body content (pitches, fifths, time signature, part-names)
        expect(xml1).toContain(`<fifths>${fifths}</fifths>`);
        expect(xml1).toContain('<beats>2</beats>');
        expect(xml1).toContain('<beat-type>4</beat-type>');
        expect(xml1).toContain('<step>');
        expect(xml1).toContain('<duration>');

        // Import back to internal score
        const { score: score2, report: importReport } = parseMusicXmlToScore(xml1);
        expect(importReport.isLossless).toBe(true);
        expect(importReport.errors).toHaveLength(0);

        // Assert on parsed musical content:
        // Key signature
        expect(score2.key).toBe(score1.key);
        // Time signature
        expect(score2.meter).toBe(score1.meter);
        // Voice declarations
        expect(score2.voices.length).toBe(score1.voices.length);
        for (let i = 0; i < score1.voices.length; i++) {
          expect(score2.voices[i].name).toBe(score1.voices[i].name);
        }

        // Compare all notes, pitches, durations, and Sol-fa syllables voice-by-voice
        for (const voice of score1.voices) {
          const vNotes1 = score1.systems.flatMap((s) => s.voices[voice.id]?.measures.flatMap((m) => m.notes) || []);
          const vNotes2 = score2.systems.flatMap((s) => s.voices[voice.id]?.measures.flatMap((m) => m.notes) || []);

          expect(vNotes2.length).toBe(vNotes1.length);
          for (let i = 0; i < vNotes1.length; i++) {
            const n1 = vNotes1[i];
            const n2 = vNotes2[i];
            expect(n2.isRest).toBe(n1.isRest);
            expect(n2.durationTicks).toBe(n1.durationTicks);
            expect(n2.midiPitch).toBe(n1.midiPitch);
            expect(n2.syllable).toBe(n1.syllable);
            expect(n2.scaleDegree).toBe(n1.scaleDegree);
          }
        }

        // Compare MIDI note events before and after conversion (Requirement 5)
        const midiEvents1 = extractMidiEvents(score1);
        const midiEvents2 = extractMidiEvents(score2);
        expect(midiEvents2).toEqual(midiEvents1);

        // Round-trip 2: XML -> internal -> XML
        const { xml: xml2 } = serializeScoreToMusicXml(score2);
        const { score: score3 } = parseMusicXmlToScore(xml2);
        const midiEvents3 = extractMidiEvents(score3);
        expect(midiEvents3).toEqual(midiEvents1);

        // Round-trip 3: ABC -> internal -> XML -> internal -> ABC
        const abc2 = serializeScoreToAbc(score2);
        const scoreFromAbc2 = new SolfaTransformer().transform(new AbcParser().parse(abc2).score);
        const midiEventsFromAbc2 = extractMidiEvents(scoreFromAbc2);
        expect(midiEventsFromAbc2).toEqual(midiEvents1);
      });
    });
  });

  describe('(6) Safe Failure on Malformed XML', () => {
    it('catches unclosed XML tags safely with descriptive errors', () => {
      const malformedXml = `<score-partwise><identification><broken`;
      expect(() => parseMusicXmlToScore(malformedXml)).toThrowError(MusicXmlParseError);
    });

    it('catches empty or non-XML text safely with descriptive errors', () => {
      expect(() => parseMusicXmlToScore('')).toThrowError(MusicXmlParseError);
      expect(() => parseMusicXmlToScore('This is just plain text, not XML')).toThrowError(MusicXmlParseError);
    });

    it('catches missing root or part-list safely', () => {
      const noPartListXml = `<score-partwise><work><work-title>Test</work-title></work></score-partwise>`;
      expect(() => parseMusicXmlToScore(noPartListXml)).toThrowError(MusicXmlParseError);
    });
  });

  describe('Lossiness Report Formatting', () => {
    it('formats clean lossless report when conversion is 100% faithful', () => {
      const abc = loadHymnAbc('Franconia.txt');
      const score = new SolfaTransformer().transform(new AbcParser().parse(abc).score);
      const { report } = serializeScoreToMusicXml(score);
      const text = formatLossinessReport(report);
      expect(text).toContain('LOSSLESS');
      expect(text).toContain('All musical data, voices, pitches, rhythms, and Sol-fa metadata preserved with 100% fidelity.');
    });
  });
});
