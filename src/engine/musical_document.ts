/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore } from '../types';
import { LossinessReport } from './musicxml/lossiness_report';
import { SolfaTunesMetadata } from './musicxml/schema';

export interface MusicalDocumentSource {
  readonly format: 'abc' | 'musicxml';
  readonly text: string;
}

/**
 * Carries the existing editable score together with interchange provenance.
 * The score is deliberately shared by reference; this is not a second score model.
 * Original text retains constructs outside ParsedScore, while the conversion report
 * keeps partial imports distinguishable. Positional note-override keys remain addresses.
 */
export interface MusicalDocument {
  readonly score: ParsedScore;
  readonly metadata?: SolfaTunesMetadata | null;
  readonly conversionReport?: LossinessReport;
  readonly source?: MusicalDocumentSource;
}

export type MusicalDocumentDetails = Omit<MusicalDocument, 'score'>;

export function createMusicalDocument(
  score: ParsedScore,
  details: MusicalDocumentDetails = {}
): MusicalDocument {
  return Object.freeze({ score, ...details });
}

export function createAbcMusicalDocument(
  score: ParsedScore,
  sourceText: string
): MusicalDocument {
  return createMusicalDocument(score, {
    source: { format: 'abc', text: sourceText },
  });
}
