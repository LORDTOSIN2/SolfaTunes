/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  SOLFATUNES_METADATA_VERSION,
  createDefaultSolfaMetadata,
  generateStableNoteId,
  parseStableNoteId,
  validateSolfaMetadata,
  metadataToMiscellaneousFields,
  miscellaneousFieldsToMetadata,
  injectMetadataIntoMusicXml,
  extractMetadataFromMusicXml,
  escapeXml,
  unescapeXml,
  deriveKeyFromFifthsAndMode,
  reconcileMetadataWithKey,
  type SolfaTunesMetadata,
} from './schema';

describe('MusicXML SolfaTunes Metadata Contract (Phase 1)', () => {
  describe('Stable Note Addressing', () => {
    it('generates deterministic note IDs for voices and measures', () => {
      expect(generateStableNoteId('P1', 1, 0)).toBe('P1-m1-n0');
      expect(generateStableNoteId('S', 4, 3)).toBe('S-m4-n3');
      expect(generateStableNoteId('Bass', '2b', 1)).toBe('Bass-m2b-n1');
      expect(generateStableNoteId('P1', '1-2', 0)).toBe('P1-m1-2-n0');
    });

    it('parses valid note IDs correctly, including hyphenated and alphanumeric measures', () => {
      const parsed = parseStableNoteId('P1-m3-n2');
      expect(parsed).toEqual({
        partId: 'P1',
        measureNumber: '3',
        noteIndex: 2,
      });

      const parsedWithAlphanumericMeasure = parseStableNoteId('Tenor-m12a-n0');
      expect(parsedWithAlphanumericMeasure).toEqual({
        partId: 'Tenor',
        measureNumber: '12a',
        noteIndex: 0,
      });

      const parsedHyphenMeasure = parseStableNoteId('Bass-m1-2-n3');
      expect(parsedHyphenMeasure).toEqual({
        partId: 'Bass',
        measureNumber: '1-2',
        noteIndex: 3,
      });

      const parsedPartWithDash = parseStableNoteId('Choir-Soprano-m4-n1');
      expect(parsedPartWithDash).toEqual({
        partId: 'Choir-Soprano',
        measureNumber: '4',
        noteIndex: 1,
      });
    });

    it('returns null for malformed note IDs', () => {
      expect(parseStableNoteId('invalid-id')).toBeNull();
      expect(parseStableNoteId('P1-m1')).toBeNull();
      expect(parseStableNoteId('P1-n0')).toBeNull();
      expect(parseStableNoteId('')).toBeNull();
    });
  });

  describe('Single Source of Truth & Key Reconciliation', () => {
    it('derives canonical tonic and mode from MusicXML fifths', () => {
      expect(deriveKeyFromFifthsAndMode(0, 'major')).toEqual({ tonic: 'C', mode: 'major' });
      expect(deriveKeyFromFifthsAndMode(1, 'major')).toEqual({ tonic: 'G', mode: 'major' });
      expect(deriveKeyFromFifthsAndMode(-3, 'major')).toEqual({ tonic: 'Eb', mode: 'major' });
      expect(deriveKeyFromFifthsAndMode(0, 'minor')).toEqual({ tonic: 'A', mode: 'minor' });
      expect(deriveKeyFromFifthsAndMode(2, 'minor')).toEqual({ tonic: 'B', mode: 'minor' });
      expect(deriveKeyFromFifthsAndMode(-2, 'minor')).toEqual({ tonic: 'G', mode: 'minor' });
    });

    it('reconciles metadata when a score is transposed externally', () => {
      const original = createDefaultSolfaMetadata('C', 'major', 'score-1');
      // Transposed in external editor to 2 sharps (D major)
      const reconciled = reconcileMetadataWithKey(original, 2, 'major');
      expect(reconciled.tonic).toBe('D');
      expect(reconciled.mode).toBe('major');
      expect(reconciled.songId).toBe(original.songId);
    });
  });

  describe('Schema Validation', () => {
    it('validates a default metadata instance successfully', () => {
      const defaultMeta = createDefaultSolfaMetadata('G', 'major', 'test-score-1');
      const result = validateSolfaMetadata(defaultMeta);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata?.schemaVersion).toBe(SOLFATUNES_METADATA_VERSION);
      expect(result.metadata?.tonic).toBe('G');
      expect(result.metadata?.mode).toBe('major');
      expect(result.metadata?.solfaSystem).toBe('movable-do');
    });

    it('rejects missing or empty required fields', () => {
      const invalidMeta = {
        schemaVersion: '',
        songId: '',
        solfaSystem: 'fixed-do', // Invalid system
        tonic: '',
        mode: '',
        chromaticConvention: 'invalid-convention',
      };
      const result = validateSolfaMetadata(invalidMeta);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
      expect(result.errors.some((e) => e.includes('solfaSystem'))).toBe(true);
    });

    it('validates sparse noteOverrides format and flags invalid note IDs', () => {
      const metaWithOverrides: SolfaTunesMetadata = {
        ...createDefaultSolfaMetadata('F', 'major', 'score-f'),
        noteOverrides: {
          'P1-m1-n0': { syllable: 'fe', scaleDegree: 3 },
          'invalid-note-key': { syllable: 'fi' },
        },
      };

      const result = validateSolfaMetadata(metaWithOverrides);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid note override ID format'))).toBe(true);
    });
  });

  describe('XML Entity Escaping & Numeric Entity Decoding', () => {
    it('escapes and unescapes XML entities safely', () => {
      const input = `Notes & Solfa: <do> "re" 'mi' > fa`;
      const escaped = escapeXml(input);
      expect(escaped).toBe(`Notes &amp; Solfa: &lt;do&gt; &quot;re&quot; &apos;mi&apos; &gt; fa`);
      expect(unescapeXml(escaped)).toBe(input);
    });

    it('decodes numeric and hex XML character references from third-party tools', () => {
      expect(unescapeXml('&#60;score&#62;')).toBe('<score>');
      expect(unescapeXml('&#34;Title&#34;')).toBe('"Title"');
      expect(unescapeXml('&#x26;')).toBe('&');
    });
  });

  describe('Metadata Key-Value Conversion & Round-Trip', () => {
    it('preserves complete metadata through miscellaneous fields round-trip', () => {
      const original: SolfaTunesMetadata = {
        schemaVersion: '1.0',
        songId: 'franconia-hymn-123',
        solfaSystem: 'movable-do',
        tonic: 'G',
        mode: 'major',
        chromaticConvention: 'sharps-i-flats-a',
        hymn: {
          hymnMeter: 'S.M.',
          tuneName: 'FRANCONIA',
          hymnName: 'The God of Abraham Praise',
          verses: 4,
          hasDescant: false,
          voicePairingGroups: [
            ['S', 'A'],
            ['T', 'B'],
          ],
        },
        parts: {
          P1: {
            partId: 'P1',
            voiceName: 'Soprano',
            voiceRole: 'S',
            homeRegisterMidi: 67,
          },
          P2: {
            partId: 'P2',
            voiceName: 'Alto',
            voiceRole: 'A',
            homeRegisterMidi: 60,
          },
        },
        unmeteredLyrics: ['Praise the Lord, O my soul!', 'Hallelujah evermore.'],
        originalAbcSource: 'X:1\nT:FRANCONIA\nK:G\n[V:S] D | G G A A | B2',
        noteOverrides: {
          'P1-m2-n1': {
            syllable: 'fi',
            scaleDegree: 6,
            annotation: 'raised fourth modulation',
          },
        },
        extraFields: {
          'solfatunes:futureFeature': 'enabled',
        },
      };

      const fields = metadataToMiscellaneousFields(original);
      const restored = miscellaneousFieldsToMetadata(fields);

      expect(restored).not.toBeNull();
      expect(restored?.schemaVersion).toBe(original.schemaVersion);
      expect(restored?.songId).toBe(original.songId);
      expect(restored?.tonic).toBe('G');
      expect(restored?.mode).toBe('major');
      expect(restored?.chromaticConvention).toBe('sharps-i-flats-a');
      expect(restored?.hymn).toEqual(original.hymn);
      expect(restored?.parts).toEqual(original.parts);
      expect(restored?.unmeteredLyrics).toEqual(original.unmeteredLyrics);
      expect(restored?.originalAbcSource).toBe(original.originalAbcSource);
      expect(restored?.noteOverrides).toEqual(original.noteOverrides);
      expect(restored?.extraFields).toEqual({ 'solfatunes:futureFeature': 'enabled' });
    });

    it('trims whitespace and newlines from scalar fields formatted by external tools', () => {
      const rawFields = [
        { name: 'solfatunes:version', value: '  1.0  \n' },
        { name: 'solfatunes:songId', value: '\n  my-song-id \n' },
        { name: 'solfatunes:solfaSystem', value: ' movable-do ' },
        { name: 'solfatunes:tonic', value: '\n  Ab\n  ' },
        { name: 'solfatunes:mode', value: ' major ' },
        { name: 'solfatunes:chromaticConvention', value: ' sharps-i-flats-a ' },
      ];

      const parsed = miscellaneousFieldsToMetadata(rawFields);
      expect(parsed).not.toBeNull();
      expect(parsed?.tonic).toBe('Ab');
      expect(parsed?.mode).toBe('major');
      expect(parsed?.songId).toBe('my-song-id');
      expect(parsed?.solfaSystem).toBe('movable-do');
    });

    it('preserves malformed JSON fields in extraFields to prevent silent data loss', () => {
      const corruptedFields = [
        { name: 'solfatunes:version', value: '1.0' },
        { name: 'solfatunes:songId', value: 'corrupted-score' },
        { name: 'solfatunes:solfaSystem', value: 'movable-do' },
        { name: 'solfatunes:tonic', value: 'C' },
        { name: 'solfatunes:mode', value: 'major' },
        { name: 'solfatunes:chromaticConvention', value: 'sharps-i-flats-a' },
        { name: 'solfatunes:noteOverrides', value: '{ invalid JSON payload ...' },
      ];

      const parsed = miscellaneousFieldsToMetadata(corruptedFields);
      expect(parsed).not.toBeNull();
      // Raw string saved in extraFields so data is never discarded
      expect(parsed?.extraFields?.['solfatunes:noteOverrides:raw']).toBe('{ invalid JSON payload ...');
    });
  });

  describe('MusicXML Document Injection and Extraction', () => {
    const sampleMusicXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>Sample Hymn</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>MusicXML Part</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <note>
        <pitch>
          <step>G</step>
          <octave>4</octave>
        </pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

    it('injects metadata into a score lacking <identification> in schema-valid order', () => {
      const meta = createDefaultSolfaMetadata('G', 'major', 'score-no-ident');
      const output = injectMetadataIntoMusicXml(sampleMusicXml, meta);

      expect(output).toContain('<identification>');
      expect(output).toContain('<miscellaneous>');
      expect(output).toContain('<miscellaneous-field name="solfatunes:version">1.0</miscellaneous-field>');
      expect(output).toContain('<miscellaneous-field name="solfatunes:tonic">G</miscellaneous-field>');

      // Verify <identification> appears before <part-list> (MusicXML DTD requirement)
      const identIndex = output.indexOf('<identification>');
      const partListIndex = output.indexOf('<part-list>');
      expect(identIndex).toBeGreaterThan(-1);
      expect(partListIndex).toBeGreaterThan(-1);
      expect(identIndex).toBeLessThan(partListIndex);

      // Extract and verify
      const { metadata } = extractMetadataFromMusicXml(output);
      expect(metadata).not.toBeNull();
      expect(metadata?.tonic).toBe('G');
      expect(metadata?.mode).toBe('major');
    });

    it('handles self-closing <miscellaneous/> tag without creating duplicate tags', () => {
      const xmlWithSelfClosingMisc = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <identification>
    <encoding>
      <software>Sibelius</software>
    </encoding>
    <miscellaneous/>
  </identification>
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part></part-list>
</score-partwise>`;

      const meta = createDefaultSolfaMetadata('D', 'major', 'score-self-closing');
      const injected = injectMetadataIntoMusicXml(xmlWithSelfClosingMisc, meta);

      // Verify there is exactly ONE <miscellaneous> block, not two!
      const countOpen = (injected.match(/<miscellaneous>/g) || []).length;
      const countSelf = (injected.match(/<miscellaneous\s*\/>/g) || []).length;
      expect(countOpen).toBe(1);
      expect(countSelf).toBe(0);

      const { metadata } = extractMetadataFromMusicXml(injected);
      expect(metadata).not.toBeNull();
      expect(metadata?.tonic).toBe('D');
    });

    it('preserves existing non-Solfa miscellaneous fields when updating', () => {
      const existingScoreWithMisc = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <identification>
    <creator type="composer">W. H. Havergal</creator>
    <miscellaneous>
      <miscellaneous-field name="thirdparty:editor">MuseScore 4</miscellaneous-field>
      <miscellaneous-field name="thirdparty:license">CC-BY-4.0</miscellaneous-field>
    </miscellaneous>
  </identification>
  <part-list>
    <score-part id="P1"><part-name>Voice</part-name></score-part>
  </part-list>
</score-partwise>`;

      const meta = createDefaultSolfaMetadata('Eb', 'minor', 'score-eb');
      const updated = injectMetadataIntoMusicXml(existingScoreWithMisc, meta);

      const { metadata, nonSolfaFields } = extractMetadataFromMusicXml(updated);

      // Solfa metadata injected
      expect(metadata).not.toBeNull();
      expect(metadata?.tonic).toBe('Eb');
      expect(metadata?.mode).toBe('minor');

      // Non-Solfa fields preserved!
      expect(nonSolfaFields).toEqual([
        { name: 'thirdparty:editor', value: 'MuseScore 4' },
        { name: 'thirdparty:license', value: 'CC-BY-4.0' },
      ]);
    });

    it('returns null metadata gracefully when third-party software stripped <miscellaneous>', () => {
      const strippedScore = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <identification>
    <creator type="composer">Traditional</creator>
  </identification>
  <part-list>
    <score-part id="P1"><part-name>Voice</part-name></score-part>
  </part-list>
</score-partwise>`;

      const { metadata, nonSolfaFields } = extractMetadataFromMusicXml(strippedScore);
      expect(metadata).toBeNull();
      expect(nonSolfaFields).toEqual([]);
    });
  });
});
