/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { AbcParser } from './abc_parser';
import { serializeScoreToAbc } from './abc_serializer';
import { SolfaTransformer } from './solfa_transformer';
import { createAbcMusicalDocument, createMusicalDocument } from './musical_document';
import { parseMusicXmlToDocument } from './musicxml/musicxml_parser';
import { serializeScoreToMusicXml } from './musicxml/musicxml_serializer';
import {
  createDefaultSolfaMetadata,
  extractMetadataFromMusicXml,
  injectMetadataIntoMusicXml,
} from './musicxml/schema';

const abc = `X:1
T:Shared score test
C:Composer
M:3/4
L:1/4
K:C
V:S name="Soprano" clef=treble
[V:S] C2 D E |
W: first verse`;

function parseAbcScore() {
  const { score, warnings } = new AbcParser().parse(abc);
  expect(warnings).toEqual([]);
  return new SolfaTransformer().transform(score);
}

describe('MusicalDocument', () => {
  it('wraps an existing ABC score without changing its musical content', () => {
    const score = parseAbcScore();
    const before = JSON.stringify(score);
    const document = createAbcMusicalDocument(score, abc);
    const voice = document.score.systems[0].voices.S;
    const measure = voice.measures[0];

    expect(document.score).toBe(score);
    expect(JSON.stringify(score)).toBe(before);
    expect(document.source).toEqual({ format: 'abc', text: abc });
    expect(document.score.title).toBe('Shared score test');
    expect(document.score.key).toBe('C');
    expect(document.score.meter).toBe('3/4');
    expect(document.score.voices[0].id).toBe('S');
    expect(measure.notes.map(note => note.durationTicks)).toEqual([32, 16, 16]);
    expect(measure.notes[0].timestamp).toBe(0);
    expect(document.score.lyrics).toEqual(['first verse']);
  });

  it('retains explicit Sol-fa overrides and versioned metadata by reference', () => {
    const score = parseAbcScore();
    const metadata = {
      ...createDefaultSolfaMetadata('C', 'minor', 'song-42'),
      noteOverrides: {
        'S-m1-n0': { syllable: 'fi', scaleDegree: 6, isExplicit: true },
      },
    };
    const before = JSON.stringify(score);
    const document = createMusicalDocument(score, { metadata });

    expect(document.metadata).toBe(metadata);
    expect(document.metadata?.schemaVersion).toBe('1.0');
    expect(document.metadata?.songId).toBe('song-42');
    expect(document.metadata?.mode).toBe('minor');
    expect(document.metadata?.noteOverrides?.['S-m1-n0']?.syllable).toBe('fi');
    expect(JSON.stringify(score)).toBe(before);
  });

  it('keeps one editable score rather than a conflicting score copy', () => {
    const score = parseAbcScore();
    const document = createMusicalDocument(score);

    expect(Object.isFrozen(document)).toBe(true);
    expect(document.score).toBe(score);

    document.score.title = 'Edited through the existing score';
    expect(score.title).toBe('Edited through the existing score');
  });

  it('retains MusicXML metadata, source, and partial-import warnings', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>4</divisions><key><fifths>0</fifths></key></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
    <backup><duration>4</duration></backup>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>2</voice></note>
  </measure></part>
</score-partwise>`;
    const document = parseMusicXmlToDocument(xml);

    expect(document.source).toEqual({ format: 'musicxml', text: xml });
    expect(document.conversionReport?.isLossless).toBe(false);
    expect(document.conversionReport?.warnings.some(warning => warning.includes('<backup>'))).toBe(true);
    expect(document.conversionReport?.unsupportedConstructs).toContain('Polyphonic <backup> elements');
  });

  it('preserves imported explicit Sol-fa overrides and still uses the existing serializers', () => {
    const score = parseAbcScore();
    const { xml } = serializeScoreToMusicXml(score);
    const metadata = extractMetadataFromMusicXml(xml).metadata;

    if (!metadata) throw new Error('MusicXML export did not include SolfaTunes metadata.');
    metadata.songId = 'shared-song';
    metadata.noteOverrides = {
      'S-m1-n0': { syllable: 'fi', scaleDegree: 6, isExplicit: true },
    };

    const xmlWithOverride = injectMetadataIntoMusicXml(xml, metadata);
    const document = parseMusicXmlToDocument(xmlWithOverride);
    const importedNote = document.score.systems[0].voices.S.measures[0].notes[0];

    expect(importedNote.syllable).toBe('fi');
    expect(importedNote.scaleDegree).toBe(6);
    expect(document.metadata?.songId).toBe('shared-song');
    expect(document.metadata?.noteOverrides?.['S-m1-n0']?.isExplicit).toBe(true);
    expect(serializeScoreToAbc(document.score)).toContain('T:Shared score test');

    const reserializedXml = serializeScoreToMusicXml(document.score).xml;
    expect(reserializedXml).toContain('<score-partwise');
    const reparsedDocument = parseMusicXmlToDocument(reserializedXml);
    const reparsedNote = reparsedDocument.score.systems[0].voices.S.measures[0].notes[0];
    expect(reparsedNote.syllable).toBe('fi');
    expect(reparsedNote.scaleDegree).toBe(6);
    expect(reparsedDocument.metadata?.noteOverrides?.['S-m1-n0']?.isExplicit).toBe(true);
  });
});
