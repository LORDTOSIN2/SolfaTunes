/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AbcParser } from '../abc_parser';
import { SolfaTransformer } from '../solfa_transformer';
import { createAbcMusicalDocument } from '../musical_document';
import { MidiWriter } from '../../audio/midi_writer';
import { ParsedScore } from '../../types';
import { formatLossinessReport } from './lossiness_report';
import { createDefaultSolfaMetadata } from './schema';
import {
  CONVERSION_LOSSINESS_FIELD,
  ORIGINAL_MUSICXML_SOURCE_FIELD,
  confirmLossyMusicXmlReplacement,
  exportMusicXmlDocument,
  importMusicXmlDocument,
} from './document_io';

function loadFixture(name: string): string {
  return readFileSync(new URL(`../../../test/fixtures/scores/${name}`, import.meta.url), 'utf8');
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
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><tie type="start"/><voice>1</voice><type>quarter</type><notations><tied type="start"/></notations><lyric><text>one</text></lyric></note>
  </measure></part>
</score-partwise>`;

const multipartCompatibilityXml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <identification>
    <miscellaneous>
      <miscellaneous-field name="solfatunes:futureField">preserve me</miscellaneous-field>
    </miscellaneous>
  </identification>
  <part-list>
    <score-part id="P1"><part-name>Soprano</part-name></score-part>
    <score-part id="P2"><part-name>Bass</part-name></score-part>
    <score-part id="P3"><part-name>Descant</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>4</divisions></attributes>
      <attributes><key><fifths>0</fifths></key></attributes>
      <attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
      <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>72</per-minute></metronome></direction-type><sound tempo="72"/></direction>
      <direction><direction-type><words>Maestoso</words></direction-type></direction>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><tie type="start"/><voice>1</voice><type>eighth</type><notations><tied type="start"/></notations></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><tie type="stop"/><voice>1</voice><type>eighth</type><notations><tied type="stop"/><articulations><breath-mark/></articulations></notations></note>
      <note><rest/><duration>4</duration><voice>1</voice></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><lyric><text>one</text></lyric></note>
    </measure>
    <measure number="2">
      <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>60</per-minute></metronome></direction-type><sound tempo="60"/></direction>
      <attributes><divisions>8</divisions></attributes>
      <attributes><key><fifths>1</fifths></key></attributes>
      <attributes><time><beats>2</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>16</duration><voice>1</voice></note>
    </measure>
    <measure number="3">
      <attributes><time><beats>2+3</beats><beat-type>8</beat-type></time></attributes>
      <attributes><key><fifths>1</fifths><mode>minor</mode></key></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>20</duration><voice>1</voice></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>4</divisions></attributes>
      <attributes><key><fifths>0</fifths></key></attributes>
      <attributes><transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose></attributes>
      <attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>12</duration><voice>1</voice></note>
    </measure>
    <measure number="2">
      <forward><duration>4</duration></forward>
      <note><pitch><step>A</step><octave>3</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><rest/><duration>2</duration><voice>1</voice></note>
    </measure>
    <measure number="3">
      <attributes><time><beats>2+3</beats><beat-type>8</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>6</duration><voice>1</voice></note>
      <note><grace/><pitch><step>D</step><octave>3</octave></pitch><voice>1</voice></note>
      <note><unpitched><display-step>C</display-step><display-octave>3</display-octave></unpitched><duration>4</duration><voice>1</voice></note>
    </measure>
  </part>
  <part id="P3">
    <measure number="1">
      <attributes><divisions>4</divisions></attributes>
      <attributes><key><fifths>0</fifths></key></attributes>
      <attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>G</step><octave>5</octave></pitch><duration>12</duration><voice>1</voice></note>
    </measure>
  </part>
</score-partwise>`;

const staleMajorMetadataMinorXml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <identification><miscellaneous>
    <miscellaneous-field name="solfatunes:tonic">C</miscellaneous-field>
    <miscellaneous-field name="solfatunes:mode">major</miscellaneous-field>
  </miscellaneous></identification>
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>4</divisions><key><fifths>0</fifths><mode>minor</mode></key></attributes>
    <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
    <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice></note>
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
    expect(confirm.mock.calls[0][0]).not.toContain('Tempo markings');
    expect(confirm.mock.calls[0][0]).toContain('Note-aligned lyrics');

    const accepted = importMusicXmlDocument(lossyXml, () => true);
    if (!accepted) throw new Error('Confirmed lossy import was unexpectedly cancelled.');
    expect(accepted.conversionReport?.isLossless).toBe(false);
    expect(accepted.conversionReport?.unsupportedConstructs).toEqual(
      expect.arrayContaining(['Ties', 'Note-aligned lyrics'])
    );
    expect(accepted.conversionReport?.unsupportedConstructs).not.toContain('Tempo markings');
    expect(accepted.score.tempoBpm).toBe(96);
    expect(accepted.source?.text).toBe(lossyXml);
  });

  it('retains the original lossy source and loss report in exported MusicXML metadata', () => {
    const imported = importMusicXmlDocument(lossyXml, () => true);
    if (!imported) throw new Error('Confirmed lossy import was unexpectedly cancelled.');
    const editedNote = imported.score.systems[0].voices.P1.measures[0].notes[0];
    editedNote.rawLetter = 'D';
    editedNote.midiPitch = 62;
    editedNote.syllable = 'r';
    editedNote.scaleDegree = 2;

    const exported = exportMusicXmlDocument(imported);
    expect(exported.report.isLossless).toBe(false);
    expect(exported.xml).toContain(ORIGINAL_MUSICXML_SOURCE_FIELD);
    expect(exported.xml).toContain(CONVERSION_LOSSINESS_FIELD);
    expect(exported.xml).toContain('<step>D</step>');

    const reopened = importMusicXmlDocument(exported.xml, () => true);
    if (!reopened) throw new Error('Reopening the lossy export was unexpectedly cancelled.');
    expect(reopened.score.systems[0].voices.P1.measures[0].notes[0].midiPitch).toBe(62);
    expect(reopened.score.systems[0].voices.P1.measures[0].notes[0].syllable).toBe('r');
    expect(reopened.conversionReport?.isLossless).toBe(false);
    expect(reopened.conversionReport?.unsupportedConstructs).toEqual(
      expect.arrayContaining(['Ties', 'Note-aligned lyrics'])
    );
    expect(reopened.score.tempoBpm).toBe(96);
    expect(reopened.score.tempoBpm).not.toBe(100);
    expect(reopened.metadata?.extraFields?.[ORIGINAL_MUSICXML_SOURCE_FIELD]).toBe(lossyXml);
    expect(reopened.metadata?.extraFields?.[ORIGINAL_MUSICXML_SOURCE_FIELD]).toContain('<tie type="start"/>');
    expect(reopened.metadata?.extraFields?.[ORIGINAL_MUSICXML_SOURCE_FIELD]).toContain('<lyric><text>one</text></lyric>');
    expect(formatLossinessReport(reopened.conversionReport!)).toContain('LOSSY / WARNINGS DETECTED');
  });

  it('requires consent before replacing a lossy MusicXML document but not a lossless document', () => {
    const lossyDocument = importMusicXmlDocument(lossyXml, () => true);
    if (!lossyDocument) throw new Error('Confirmed lossy import was unexpectedly cancelled.');

    const rejectReplacement = vi.fn((_summary: string) => false);
    expect(confirmLossyMusicXmlReplacement(lossyDocument, rejectReplacement)).toBe(false);
    expect(rejectReplacement).toHaveBeenCalledOnce();
    expect(rejectReplacement.mock.calls[0][0]).toContain('Ties');
    expect(rejectReplacement.mock.calls[0][0]).toContain('Note-aligned lyrics');

    const acceptReplacement = vi.fn((_summary: string) => true);
    expect(confirmLossyMusicXmlReplacement(lossyDocument, acceptReplacement)).toBe(true);
    expect(acceptReplacement).toHaveBeenCalledOnce();

    const losslessDocument = importMusicXmlDocument(
      `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>4</divisions><key><fifths>0</fifths></key></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
  </measure></part>
</score-partwise>`,
      summary => {
        throw new Error(`Lossless import unexpectedly requested confirmation: ${summary}`);
      }
    );
    if (!losslessDocument) throw new Error('Lossless import was unexpectedly cancelled.');
    const unnecessaryConfirmation = vi.fn(() => false);
    expect(confirmLossyMusicXmlReplacement(losslessDocument, unnecessaryConfirmation)).toBe(true);
    expect(unnecessaryConfirmation).not.toHaveBeenCalled();

    const unverifiedDocument = { ...losslessDocument, conversionReport: undefined };
    const verifyBeforeReplacement = vi.fn((_summary: string) => false);
    expect(confirmLossyMusicXmlReplacement(unverifiedDocument, verifyBeforeReplacement)).toBe(false);
    expect(verifyBeforeReplacement.mock.calls[0][0]).toContain('cannot be ruled out');
  });

  it('supports repeated project save, reopen, edit, and save cycles without losing source recovery', () => {
    const original = importMusicXmlDocument(lossyXml, () => true);
    if (!original) throw new Error('Confirmed lossy import was unexpectedly cancelled.');

    const firstSave = exportMusicXmlDocument(original);
    const firstOpen = importMusicXmlDocument(firstSave.xml, () => true);
    if (!firstOpen) throw new Error('First project reopen was unexpectedly cancelled.');
    expect(firstOpen.metadata?.extraFields?.[ORIGINAL_MUSICXML_SOURCE_FIELD]).toBe(lossyXml);
    expect(firstOpen.conversionReport?.unsupportedConstructs).toEqual(
      expect.arrayContaining(['Ties', 'Note-aligned lyrics'])
    );

    const editedNote = firstOpen.score.systems[0].voices.P1.measures[0].notes[0];
    editedNote.rawLetter = 'D';
    editedNote.midiPitch = 62;
    editedNote.durationTicks = 8;
    editedNote.syllable = 'fe';
    editedNote.scaleDegree = 5;
    firstOpen.score.key = 'G';
    firstOpen.score.meter = '3/4';
    firstOpen.score.tempoBpm = 84;
    firstOpen.metadata!.noteOverrides = {
      'P1-m1-n0': { syllable: 'fe', scaleDegree: 5, isExplicit: true },
    };

    const secondSave = exportMusicXmlDocument(firstOpen);
    expect(secondSave.xml).toContain('<step>D</step>');
    expect(secondSave.xml).toContain('<per-minute>84</per-minute>');
    const secondOpen = importMusicXmlDocument(secondSave.xml, () => true);
    if (!secondOpen) throw new Error('Second project reopen was unexpectedly cancelled.');

    const reopenedNote = secondOpen.score.systems[0].voices.P1.measures[0].notes[0];
    expect(reopenedNote.midiPitch).toBe(62);
    expect(reopenedNote.durationTicks).toBe(8);
    expect(reopenedNote.timestamp).toBe(0);
    expect(reopenedNote.syllable).toBe('fe');
    expect(reopenedNote.scaleDegree).toBe(5);
    expect(secondOpen.score.key).toBe('G');
    expect(secondOpen.score.meter).toBe('3/4');
    expect(secondOpen.score.tempoBpm).toBe(84);
    expect(secondOpen.metadata?.noteOverrides?.['P1-m1-n0']).toMatchObject({
      syllable: 'fe',
      scaleDegree: 5,
      isExplicit: true,
    });
    expect(secondOpen.metadata?.extraFields?.[ORIGINAL_MUSICXML_SOURCE_FIELD]).toBe(lossyXml);
    expect(secondOpen.conversionReport?.isLossless).toBe(false);

    const thirdSave = exportMusicXmlDocument(secondOpen);
    const thirdOpen = importMusicXmlDocument(thirdSave.xml, () => true);
    if (!thirdOpen) throw new Error('Repeated project reopen was unexpectedly cancelled.');
    expect(noteEvents(thirdOpen.score)).toEqual(noteEvents(secondOpen.score));
    expect(Array.from(MidiWriter.generateMidiBytes(thirdOpen.score, thirdOpen.score.tempoBpm!)))
      .toEqual(Array.from(MidiWriter.generateMidiBytes(secondOpen.score, secondOpen.score.tempoBpm!)));
    expect(thirdOpen.score.tempoBpm).toBe(84);
    expect(thirdOpen.metadata?.extraFields?.[ORIGINAL_MUSICXML_SOURCE_FIELD]).toBe(lossyXml);
    expect(thirdOpen.conversionReport?.unsupportedConstructs).toEqual(
      expect.arrayContaining(['Ties', 'Note-aligned lyrics'])
    );
  });

  it('exports a user-adjusted tempo without losing the original unsupported source', () => {
    const imported = importMusicXmlDocument(lossyXml, () => true);
    if (!imported) throw new Error('Confirmed tempo import was unexpectedly cancelled.');
    imported.score.tempoBpm = 84;

    const exported = exportMusicXmlDocument(imported);
    expect(exported.xml).toContain('<per-minute>84</per-minute>');
    const reopened = importMusicXmlDocument(exported.xml, () => true);
    if (!reopened) throw new Error('Tempo edit export was unexpectedly cancelled.');

    expect(reopened.score.tempoBpm).toBe(84);
    expect(reopened.metadata?.extraFields?.[ORIGINAL_MUSICXML_SOURCE_FIELD]).toBe(lossyXml);
    expect(reopened.conversionReport?.isLossless).toBe(false);
    expect(Array.from(MidiWriter.generateMidiBytes(reopened.score, 84))).not.toEqual(
      Array.from(MidiWriter.generateMidiBytes(reopened.score, 100))
    );
  });

  it('round-trips multipart rhythms and rests while retaining loss and metadata reports', () => {
    const imported = importMusicXmlDocument(multipartCompatibilityXml, () => true);
    if (!imported) throw new Error('Confirmed multipart import was unexpectedly cancelled.');

    expect(imported.conversionReport?.isLossless).toBe(false);
    expect(imported.conversionReport?.unsupportedConstructs).toEqual(
      expect.arrayContaining([
        'Ties',
        'Note-aligned lyrics',
        'Mid-score key changes',
        'Mid-score meter changes',
        'Transposing instruments',
        'Forward elements',
        'Grace notes',
        'Unpitched notes',
        'Complex meters',
        'Direction markings',
        'Note notations',
        'Tempo changes',
      ])
    );
    expect(imported.score.tempoBpm).toBe(72);
    expect(imported.conversionReport?.warnings).toContain(
      'Mid-score key change detected at measure 3 (fifths: 1, mode: minor). SolfaTunes currently supports a single global key; initial key "C" was retained.'
    );
    expect(imported.score.key).toBe('C');
    expect(imported.score.meter).toBe('3/4');
    expect(imported.score.voices.map(voice => voice.name)).toEqual(['Soprano', 'Bass', 'Descant']);
    expect(imported.score.systems[0].voices.P3.measures[0].notes.map(note => [
      note.isRest,
      note.durationTicks,
      note.midiPitch,
    ])).toEqual([[false, 48, 79]]);
    expect(imported.score.systems[0].voices.P1.measures[0].notes.map(note => [
      note.isRest,
      note.durationTicks,
      note.midiPitch,
    ])).toEqual([
      [false, 8, 72],
      [false, 8, 72],
      [true, 16, 0],
      [false, 16, 74],
    ]);
    expect(imported.score.systems[0].voices.P2.measures[0].notes.map(note => [
      note.isRest,
      note.durationTicks,
      note.midiPitch,
    ])).toEqual([[false, 48, 55]]);
    expect(imported.score.systems[0].voices.P1.measures[1].notes[0].durationTicks).toBe(32);

    const exported = exportMusicXmlDocument(imported);
    expect(exported.report.isLossless).toBe(false);
    expect(exported.report.unsupportedConstructs).toEqual(
      expect.arrayContaining([
        'Ties',
        'Note-aligned lyrics',
        'Mid-score key changes',
        'Mid-score meter changes',
        'Transposing instruments',
        'Forward elements',
        'Grace notes',
        'Unpitched notes',
        'Complex meters',
        'Direction markings',
        'Note notations',
        'Tempo changes',
      ])
    );
    expect(exported.xml).toContain('<per-minute>72</per-minute>');
    expect(exported.xml).toContain('<sound tempo="72"/>');

    const reopened = importMusicXmlDocument(exported.xml, () => true);
    if (!reopened) throw new Error('Reopening the multipart export was unexpectedly cancelled.');
    expect(reopened.score.tempoBpm).toBe(72);
    expect(noteEvents(reopened.score)).toEqual(noteEvents(imported.score));
    expect(Array.from(MidiWriter.generateMidiBytes(reopened.score, reopened.score.tempoBpm!))).toEqual(
      Array.from(MidiWriter.generateMidiBytes(imported.score, imported.score.tempoBpm!))
    );
    expect(Array.from(MidiWriter.generateMidiBytes(reopened.score, 72))).not.toEqual(
      Array.from(MidiWriter.generateMidiBytes(reopened.score, 100))
    );
    expect(reopened.metadata?.extraFields?.['solfatunes:futureField']).toBe('preserve me');
    expect(reopened.metadata?.extraFields?.[ORIGINAL_MUSICXML_SOURCE_FIELD]).toBe(multipartCompatibilityXml);
    expect(reopened.conversionReport?.isLossless).toBe(false);
    expect(reopened.conversionReport?.unsupportedConstructs).toEqual(
      expect.arrayContaining([
        'Ties',
        'Note-aligned lyrics',
        'Mid-score key changes',
        'Mid-score meter changes',
        'Transposing instruments',
        'Forward elements',
        'Grace notes',
        'Unpitched notes',
        'Complex meters',
        'Direction markings',
        'Note notations',
        'Tempo changes',
      ])
    );
  });

  it('normalizes metronome beat units to quarter-note playback tempo', () => {
    const halfNoteBeatXml = `<score-partwise version="4.0">
      <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
      <part id="P1"><measure number="1">
        <attributes><divisions>4</divisions><key><fifths>0</fifths></key></attributes>
        <direction><direction-type><metronome><beat-unit>half</beat-unit><per-minute>60</per-minute></metronome></direction-type></direction>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><voice>1</voice></note>
      </measure></part>
    </score-partwise>`;
    const imported = importMusicXmlDocument(halfNoteBeatXml, summary => {
      throw new Error(`Valid metronome marking was unexpectedly lossy: ${summary}`);
    });
    if (!imported) throw new Error('Metronome import was unexpectedly cancelled.');

    expect(imported.score.tempoBpm).toBe(120);
    const exported = exportMusicXmlDocument(imported);
    expect(exported.xml).toContain('<beat-unit>quarter</beat-unit>');
    expect(exported.xml).toContain('<per-minute>120</per-minute>');
    const reopened = importMusicXmlDocument(exported.xml, () => true);
    if (!reopened) throw new Error('Metronome export was unexpectedly cancelled.');
    expect(reopened.score.tempoBpm).toBe(120);

    const uninterpretable = importMusicXmlDocument(
      halfNoteBeatXml.replace('<per-minute>60</per-minute>', '<per-minute>Allegro</per-minute>'),
      () => true
    );
    if (!uninterpretable) throw new Error('Confirmed uninterpretable tempo import was cancelled.');
    expect(uninterpretable.score.tempoBpm).toBeUndefined();
    expect(uninterpretable.conversionReport?.unsupportedConstructs).toContain('Tempo markings');
  });

  it('uses the MusicXML key as authoritative and preserves supported minor semantics', () => {
    const imported = importMusicXmlDocument(staleMajorMetadataMinorXml, summary => {
      throw new Error(`Supported minor-key import was unexpectedly lossy: ${summary}`);
    });
    if (!imported) throw new Error('Minor-key import was unexpectedly cancelled.');

    expect(imported.score.key).toBe('Am');
    expect(imported.score.systems[0].voices.P1.measures[0].notes.map(note => note.syllable))
      .toEqual(['d', 'ri']);
    expect(imported.metadata?.tonic).toBe('A');
    expect(imported.metadata?.mode).toBe('minor');

    const exported = exportMusicXmlDocument(imported);
    expect(exported.xml).toContain('<mode>minor</mode>');
    const reopened = importMusicXmlDocument(exported.xml, () => true);
    if (!reopened) throw new Error('Minor-key export was unexpectedly cancelled.');
    expect(reopened.score.key).toBe('Am');
    expect(reopened.metadata?.tonic).toBe('A');
    expect(reopened.metadata?.mode).toBe('minor');
    expect(reopened.score.systems[0].voices.P1.measures[0].notes.map(note => note.syllable))
      .toEqual(['d', 'ri']);

    const metadataModeXml = staleMajorMetadataMinorXml
      .replace('name="solfatunes:mode">major', 'name="solfatunes:mode">minor')
      .replace('<mode>minor</mode>', '');
    const metadataMode = importMusicXmlDocument(metadataModeXml, summary => {
      throw new Error(`Supported metadata minor-key import was unexpectedly lossy: ${summary}`);
    });
    if (!metadataMode) throw new Error('Metadata minor-key import was unexpectedly cancelled.');
    expect(metadataMode.score.key).toBe('Am');
    expect(metadataMode.metadata?.mode).toBe('minor');

    const unsupportedModeXml = staleMajorMetadataMinorXml.replace(
      '<mode>minor</mode>',
      '<mode>dorian</mode>'
    );
    const unsupportedMode = importMusicXmlDocument(unsupportedModeXml, () => true);
    if (!unsupportedMode) throw new Error('Confirmed modal import was unexpectedly cancelled.');
    expect(unsupportedMode.conversionReport?.isLossless).toBe(false);
    expect(unsupportedMode.conversionReport?.unsupportedConstructs).toContain('Non-major/minor modes');
  });

  it('rejects malformed XML without producing an import document', () => {
    expect(() => importMusicXmlDocument('<score-partwise><broken', () => true))
      .toThrowError(/Failed to parse MusicXML/);
  });
});
