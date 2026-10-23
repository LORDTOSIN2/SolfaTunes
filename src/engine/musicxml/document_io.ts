/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MusicalDocument, createMusicalDocument } from '../musical_document';
import { MusicXmlParseError, parseMusicXmlToDocument } from './musicxml_parser';
import { MusicXmlExportResult, serializeScoreToMusicXml } from './musicxml_serializer';
import { LossinessReport, formatLossinessReport } from './lossiness_report';
import {
  SolfaTunesMetadata,
  extractMetadataFromMusicXml,
  generateStableNoteId,
  injectMetadataIntoMusicXml,
} from './schema';

export const ORIGINAL_MUSICXML_SOURCE_FIELD = 'solfatunes:originalMusicXmlSource';
export const CONVERSION_LOSSINESS_FIELD = 'solfatunes:conversionLossiness';

function isLossinessReport(value: unknown): value is LossinessReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as Partial<LossinessReport>;
  return typeof report.isLossless === 'boolean' &&
    Array.isArray(report.warnings) &&
    Array.isArray(report.unsupportedConstructs) &&
    Array.isArray(report.strippedElements) &&
    Array.isArray(report.errors) &&
    [...report.warnings, ...report.unsupportedConstructs, ...report.strippedElements, ...report.errors]
      .every(item => typeof item === 'string');
}

function mergeLossinessReports(current: LossinessReport, previous?: string): LossinessReport {
  if (!previous) return current;
  let parsed: unknown;
  try {
    parsed = JSON.parse(previous);
  } catch {
    return {
      ...current,
      isLossless: false,
      warnings: [...current.warnings, 'Stored conversion-loss metadata could not be read.'],
      unsupportedConstructs: [...current.unsupportedConstructs, 'Unreadable stored conversion-loss metadata'],
    };
  }

  if (!isLossinessReport(parsed)) {
    return {
      ...current,
      isLossless: false,
      warnings: [...current.warnings, 'Stored conversion-loss metadata has an invalid format.'],
      unsupportedConstructs: [...current.unsupportedConstructs, 'Invalid stored conversion-loss metadata'],
    };
  }

  return {
    isLossless: current.isLossless && parsed.isLossless,
    warnings: [...new Set([...parsed.warnings, ...current.warnings])],
    unsupportedConstructs: [...new Set([...parsed.unsupportedConstructs, ...current.unsupportedConstructs])],
    strippedElements: [...new Set([...parsed.strippedElements, ...current.strippedElements])],
    errors: [...new Set([...parsed.errors, ...current.errors])],
  };
}

export function importMusicXmlDocument(
  xml: string,
  confirmLossyImport: (summary: string) => boolean
): MusicalDocument | null {
  const imported = parseMusicXmlToDocument(xml);
  const { score, metadata, conversionReport, source } = imported;
  if (!conversionReport) {
    throw new Error('MusicXML parser did not produce a conversion report.');
  }
  const report = mergeLossinessReports(
    conversionReport,
    metadata?.extraFields?.[CONVERSION_LOSSINESS_FIELD]
  );
  const document = createMusicalDocument(score, {
    metadata,
    conversionReport: report,
    source,
  });

  if (!report.isLossless && !confirmLossyImport(formatLossinessReport(report))) {
    return null;
  }
  return document;
}

export function confirmLossyMusicXmlReplacement(
  document: MusicalDocument | null,
  confirmReplacement: (summary: string) => boolean
): boolean {
  if (document?.source?.format !== 'musicxml') return true;
  const report = document.conversionReport;
  if (!report) {
    return confirmReplacement(
      'No conversion-loss report is available, so unsupported source content cannot be ruled out.'
    );
  }
  if (report.isLossless) return true;
  return confirmReplacement(formatLossinessReport(report));
}

function mergeMetadata(
  generated: SolfaTunesMetadata,
  existing: SolfaTunesMetadata | null | undefined,
  source: MusicalDocument['source'],
  report: LossinessReport
): SolfaTunesMetadata {
  if (!existing) {
    const extraFields = { ...generated.extraFields };
    if (source?.format === 'musicxml') {
      extraFields[ORIGINAL_MUSICXML_SOURCE_FIELD] = source.text;
    }
    if (!report.isLossless) {
      extraFields[CONVERSION_LOSSINESS_FIELD] = JSON.stringify(report);
    }
    return {
      ...generated,
      originalAbcSource: source?.format === 'abc' ? source.text : generated.originalAbcSource,
      extraFields,
    };
  }

  const extraFields = { ...existing.extraFields, ...generated.extraFields };
  if (source?.format === 'musicxml' && !extraFields[ORIGINAL_MUSICXML_SOURCE_FIELD]) {
    extraFields[ORIGINAL_MUSICXML_SOURCE_FIELD] = source.text;
  }
  if (!report.isLossless) {
    extraFields[CONVERSION_LOSSINESS_FIELD] = JSON.stringify(report);
  }

  const generatedOverrides = generated.noteOverrides || {};
  const existingOverrides = existing.noteOverrides || {};
  const noteOverrides = Object.fromEntries(
    Object.entries(generatedOverrides).map(([noteId, current]) => [
      noteId,
      { ...existingOverrides[noteId], ...current },
    ])
  );

  return {
    ...generated,
    schemaVersion: existing.schemaVersion,
    songId: existing.songId,
    chromaticConvention: existing.chromaticConvention,
    hymn: {
      hymnMeter: generated.hymn?.hymnMeter ?? existing.hymn?.hymnMeter,
      tuneName: generated.hymn?.tuneName ?? existing.hymn?.tuneName,
      hymnName: generated.hymn?.hymnName ?? existing.hymn?.hymnName,
      verses: generated.hymn?.verses ?? existing.hymn?.verses,
      hasDescant: generated.hymn?.hasDescant ?? existing.hymn?.hasDescant,
      voicePairingGroups: generated.hymn?.voicePairingGroups ?? existing.hymn?.voicePairingGroups,
      systemVoiceMeasureCounts:
        generated.hymn?.systemVoiceMeasureCounts ?? existing.hymn?.systemVoiceMeasureCounts,
    },
    parts: existing.parts,
    originalAbcSource: source?.format === 'abc'
      ? source.text
      : existing.originalAbcSource || generated.originalAbcSource,
    extraFields,
    noteOverrides,
  };
}

export function exportMusicXmlDocument(document: MusicalDocument): MusicXmlExportResult {
  const result = serializeScoreToMusicXml(document.score);
  const generatedMetadata = extractMetadataFromMusicXml(result.xml).metadata;
  if (!generatedMetadata) {
    throw new Error('MusicXML serializer did not produce SolfaTunes metadata.');
  }

  const report = document.conversionReport
    ? mergeLossinessReports(result.report, JSON.stringify(document.conversionReport))
    : result.report;
  const metadata = mergeMetadata(generatedMetadata, document.metadata, document.source, report);
  return {
    xml: injectMetadataIntoMusicXml(result.xml, metadata),
    report,
  };
}

export function applyExplicitSolfaOverrides(
  document: MusicalDocument
): MusicalDocument['score'] {
  const score = document.score;
  const overrides = document.metadata?.noteOverrides;
  if (!overrides) return score;

  score.voices.forEach(voice => {
    let measureNumber = 0;
    score.systems.forEach(system => {
      const voiceLine = system.voices[voice.id];
      if (!voiceLine) return;
      voiceLine.measures.forEach(measure => {
        measureNumber++;
        measure.notes.forEach((note, noteIndex) => {
          const override = overrides[generateStableNoteId(voice.id, measureNumber, noteIndex)];
          if (!note.isRest && override?.isExplicit && override.syllable) {
            note.syllable = override.syllable;
            if (override.scaleDegree !== undefined) note.scaleDegree = override.scaleDegree;
          }
        });
      });
    });
  });
  return score;
}

export { MusicXmlParseError };
