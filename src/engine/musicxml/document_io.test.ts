/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AbcParser } from '../abc_parser';
import { SolfaTransformer } from '../solfa_transformer';
import { createAbcMusicalDocument } from '../musical_document';
import { ParsedScore } from '../../types';
import { formatLossinessReport } from './lossiness_report';
import { createDefaultSolfaMetadata } from './schema';
import {
  CONVERSION_LOSSINESS_FIELD,
  ORIGINAL_MUSICXML_SOURCE_FIELD,
  exportMusicXmlDocument,
  importMusicXmlDocument,
} from './document_io';

function loadFixture(name: string): string {
  return readFileSync(new URL(`../../../scores/${name}`, import.meta.url), 'utf8');
}

function parseAbc(source: string): ParsedScore {
  const { score, warnings } = new AbcParser().parse(source);
  expect(warnings).toEqual([]);
  return new SolfaTransformer().transform(score);
}

function noteEvents(score: ParsedScore) {
  return score.voices.flatMap(voice =>
    score.systems.flatMap(system =>
      (system.voices[voice.id]?.measures || []).flatMap((measure, measureIndex) =>
        measure.notes.map(note => ({
          voiceId: voice.id,
          measureIndex,
          isRest: note.isRest,
          writtenStep: note.rawLetter?.toUpperCase(),
          octaveNum: note.octaveNum,
          midiPitch: note.midiPitch,
          durationTicks: note.durationTicks,
          timestamp: note.timestamp,
          syllable: note.syllable,
          scaleDegree: note.scaleDegree,
        }))
      )
    )
  );
}

const lossyXml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>4</divisions><key><fifths>0</fifths></key></attributes>
    <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>96</per-minute></metronome></direction-type></direction>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><tie type="start"/><lyric><text>one</text></lyric></note>
  </measure></part>
</score-partwise>`;

describe('MusicXML document import/export workflow', () => {
  it.each(['Franconia.txt', 'Vienna.txt', 'Winchester New.txt'])(
    'preserves supported musical content and ABC provenance for %s',
    fileName => {
      const abc = loadFixture(fileName);
      const score = parseAbc(abc);
      const document = createAbcMusicalDocument(score, abc);
      const exported = exportMusicXmlDocument(document);
      const imported = importMusicXmlDocument(exported.xml, () => {
        throw new Error('A complete fixture round-trip must not request lossy-import confirmation.');
      });

      if (!imported) throw new Error('A complete fixture round-trip was unexpectedly cancelled.');
      expect(exported.report.isLossless).toBe(true);
      expect(imported.conversionReport?.isLossless).toBe(true);
      expect(imported.source).toEqual({ format: 'musicxml', text: exported.xml });
      expect(imported.metadata?.originalAbcSource).toBe(abc);
      expect(imported.score.title).toBe(score.title);
      expect(imported.score.key).toBe(score.key);
      expect(imported.score.meter).toBe(score.meter);
      expect(imported.score.lyrics).toEqual(score.lyrics);
      expect(imported.score.voices.map(voice => [voice.id, voice.name, voice.clef])).toEqual(
        score.voices.map(voice => [voice.id, voice.name, voice.clef])
      );
      expect(noteEvents(imported.score)).toEqual(noteEvents(score));
    }
  );

  it('preserves explicit Sol-fa identity and existing metadata through export and reopen', () => {
    const abc = loadFixture('Vienna.txt');
    const score = parseAbc(abc);
    const voice = score.voices[0];
    const note = score.systems[0].voices[voice.id].measures[0].notes[0];
    note.syllable = 'fe';
    note.scaleDegree = 5;

    const metadata = {
      ...createDefaultSolfaMetadata(score.key, 'major', 'vienna-stable-id'),
      parts: { [voice.id]: { partId: voice.id, voiceRole: 'S' as const } },
      noteOverrides: {
        [`${voice.id}-m1-n0`]: {
          syllable: 'fe',
          scaleDegree: 5,
          isExplicit: true,
          annotation: 'user override',
        },
      },
    };
    const document = createAbcMusicalDocument(score, abc);
    const withMetadata = { ...document, metadata };
    const { xml } = exportMusicXmlDocument(withMetadata);
    const reopened = importMusicXmlDocument(xml, () => true);

    if (!reopened) throw new Error('MusicXML reopen was unexpectedly cancelled.');
    const reopenedNote = reopened.score.systems[0].voices[voice.id].measures[0].notes[0];
    expect(reopenedNote.syllable).toBe('fe');
    expect(reopenedNote.scaleDegree).toBe(5);
    expect(reopened.metadata?.schemaVersion).toBe(metadata.schemaVersion);
    expect(reopened.metadata?.songId).toBe('vienna-stable-id');
    expect(reopened.metadata?.parts?.[voice.id]?.voiceRole).toBe('S');
    expect(reopened.metadata?.noteOverrides?.[`${voice.id}-m1-n0`]?.annotation).toBe('user override');
    expect(reopened.metadata?.originalAbcSource).toBe(abc);
  });

  it('requires confirmation for unsupported constructs and cancellation leaves import unapplied', () => {
    const confirm = vi.fn((_summary: string) => false);
    const cancelled = importMusicXmlDocument(lossyXml, confirm);

    expect(cancelled).toBeNull();
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0]).toContain('Ties');
    expect(confirm.mock.calls[0][0]).toContain('Tempo markings');
    expect(confirm.mock.calls[0][0]).toContain('Note-aligned lyrics');

    const accepted = importMusicXmlDocument(lossyXml, () => true);
    if (!accepted) throw new Error('Confirmed lossy import was unexpectedly cancelled.');
    expect(accepted.conversionReport?.isLossless).toBe(false);
    expect(accepted.conversionReport?.unsupportedConstructs).toEqual(
      expect.arrayContaining(['Ties', 'Tempo markings', 'Note-aligned lyrics'])
    );
    expect(accepted.source?.text).toBe(lossyXml);
  });

  it('retains the original lossy source and loss report in exported MusicXML metadata', () => {
    const imported = importMusicXmlDocument(lossyXml, () => true);
    if (!imported) throw new Error('Confirmed lossy import was unexpectedly cancelled.');

    const exported = exportMusicXmlDocument(imported);
    expect(exported.report.isLossless).toBe(false);
    expect(exported.xml).toContain(ORIGINAL_MUSICXML_SOURCE_FIELD);
    expect(exported.xml).toContain(CONVERSION_LOSSINESS_FIELD);

    const reopened = importMusicXmlDocument(exported.xml, () => true);
    if (!reopened) throw new Error('Reopening the lossy export was unexpectedly cancelled.');
    expect(reopened.conversionReport?.isLossless).toBe(false);
    expect(reopened.conversionReport?.unsupportedConstructs).toEqual(
      expect.arrayContaining(['Ties', 'Tempo markings', 'Note-aligned lyrics'])
    );
    expect(reopened.metadata?.extraFields?.[ORIGINAL_MUSICXML_SOURCE_FIELD]).toBe(lossyXml);
    expect(formatLossinessReport(reopened.conversionReport!)).toContain('LOSSY / WARNINGS DETECTED');
  });

  it('rejects malformed XML without producing an import document', () => {
    expect(() => importMusicXmlDocument('<score-partwise><broken', () => true))
      .toThrowError(/Failed to parse MusicXML/);
  });
});
