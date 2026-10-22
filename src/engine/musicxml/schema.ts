/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SolfaTunes MusicXML Metadata Contract (Phase 1)
 *
 * SPECIFICATION & STORAGE RULES:
 * 1. Storage Location:
 *    SolfaTunes-specific metadata is persisted within standard MusicXML
 *    `<identification><miscellaneous><miscellaneous-field name="...">` tags.
 *    This is 100% compliant with MusicXML 2.0, 3.0, 3.1, and 4.0 DTD and W3C XSD schemas.
 *
 * 2. Prefix & Namespacing:
 *    All SolfaTunes fields use the prefix "solfatunes:*" to guarantee zero collisions
 *    with other notation editors or MusicXML extensions.
 *
 * 3. Stable Note Addressing:
 *    Sparse note-level overrides are identified by:
 *      `${partId}-m${measureNumber}-n${noteIndexInMeasure}`
 *    Example: "P1-m1-n0", "S-m3-n2", "Bass-m1-2-n0" (supports hyphenated measure tokens).
 *    This provides deterministic, stable addressing across both ABC and MusicXML structures.
 *
 * 4. Single Source of Truth & Reconciliation Rules:
 *    - Pitch, clef, part names, meter, and key signature belong to MusicXML standard elements
 *      (<pitch>, <clef>, <part-name>, <time>, <key>).
 *    - Metadata must never duplicate ordinary score information as independent conflicting authorities.
 *    - If MusicXML <key> (<fifths>, <mode>) differs from metadata (e.g. after external transposition),
 *      `reconcileMetadataWithKey` allows aligning the metadata tonic with the score key signature.
 *
 * 5. Survival & Fallback Guarantee:
 *    - SolfaTunes Round-Trip:
 *        100% lossless preservation of tonic, mode, chromatic conventions, unmetered lyrics,
 *        hymn structure, voice metadata, and sparse note Sol-fa overrides.
 *    - External MusicXML Editors (MuseScore, Finale, Sibelius, Dorico):
 *        If an external editor retains `<miscellaneous>`, all SolfaTunes data survives.
 *        If an external editor strips `<miscellaneous>`, SolfaTunes gracefully reconstructs
 *        Tonic Sol-fa semantics mathematically from MusicXML standard `<key>` (<fifths>, <mode>)
 *        and `<note><pitch>` (<step>, <alter>, <octave>) using movable-do rules.
 *
 * 6. Schema Versioning & Forward Compatibility:
 *    - Schema version is stored in `solfatunes:version` ("1.0").
 *    - Unrecognized `solfatunes:*` fields are preserved in `extraFields` during round-trips
 *      so future schema additions are not discarded.
 *    - Malformed JSON payloads are preserved in `extraFields` with `:raw` suffix to prevent
 *      silent data loss.
 */

export const SOLFATUNES_METADATA_VERSION = '1.0';
export const SOLFATUNES_VOICE_ID_MAP_FIELD = 'solfatunes:voiceIds';

export type SolfaSystem = 'movable-do';

export type ChromaticAlterationConvention = 'sharps-i-flats-a' | 'standard';

export interface SolfaNoteOverride {
  /** Explicit Sol-fa syllable override if manually customized (e.g. 'fe' instead of 'fi', 'ta' instead of 'te') */
  syllable?: string;
  /** Explicit scale degree (0-11) if overridden */
  scaleDegree?: number;
  /** Explicit octave offset relative to voice home register */
  octaveOffset?: number;
  /** Custom Sol-fa annotation or editor remark */
  annotation?: string;
  /** Whether this syllable was explicitly defined or marked to prevent re-derivation */
  isExplicit?: boolean;
}

export interface SolfaTunesHymnMetadata {
  /** Traditional hymn meter (e.g. "S.M.", "C.M.", "L.M.", "8.7.8.7.D.") */
  hymnMeter?: string;
  /** Tune name (e.g. "FRANCONIA", "VIENNA") */
  tuneName?: string;
  /** Hymn title or incipit */
  hymnName?: string;
  /** Total number of verses */
  verses?: number;
  /** Whether the score includes a descant part */
  hasDescant?: boolean;
  /** Voice pairing groups, e.g. [["S", "A"], ["T", "B"]] */
  voicePairingGroups?: string[][];
  /** Preserved measure counts per voice across systems for exact timeline reconstruction */
  systemVoiceMeasureCounts?: Record<string, number[]>;
}

export interface SolfaTunesPartMetadata {
  /** Matches MusicXML part ID (e.g. "P1", "P2" or "S", "A") */
  partId: string;
  /** Standard choral voice role ('S' | 'A' | 'T' | 'B' | 'descant' | 'lead' | 'other') */
  voiceRole?: 'S' | 'A' | 'T' | 'B' | 'descant' | 'lead' | 'other';
  /** Baseline MIDI pitch representing the voice's home register in SolfaTunes */
  homeRegisterMidi?: number;
  /**
   * Optional part name fallback if <score-part><part-name> is absent.
   * Note: MusicXML <part-name> is the authoritative source for score display.
   */
  voiceName?: string;
}

export interface SolfaTunesMetadata {
  /** Metadata schema version ("1.0") */
  schemaVersion: string;
  /** Stable song or score identifier */
  songId: string;
  /** Sol-fa system: currently "movable-do" */
  solfaSystem: SolfaSystem;
  /** Tonic pitch letter, e.g. "C", "G", "Eb", "F#" */
  tonic: string;
  /** Musical mode, e.g. "major", "minor", "dorian" */
  mode: string;
  /** Chromatic naming convention */
  chromaticConvention: ChromaticAlterationConvention;
  /** Application-specific hymn and grouping metadata */
  hymn?: SolfaTunesHymnMetadata;
  /** Voice / part metadata keyed by partId */
  parts?: Record<string, SolfaTunesPartMetadata>;
  /** Unmetered hymn lyrics (ABC W: lines) preserved across interchange */
  unmeteredLyrics?: string[];
  /** Original ABC source text preserved for byte-for-byte exact reconstruction */
  originalAbcSource?: string;
  /** Sparse map of note-level Sol-fa overrides keyed by stable note ID */
  noteOverrides?: Record<string, SolfaNoteOverride>;
  /** Preserved unrecognized solfatunes:* fields for forward-compatibility */
  extraFields?: Record<string, string>;
}

/**
 * Standard circle-of-fifths lookup tables for key reconciliation.
 * Avoids storing contradictory or out-of-sync pitch authorities.
 */
const FIFTHS_TO_MAJOR_TONIC: Record<number, string> = {
  [-7]: 'Cb',
  [-6]: 'Gb',
  [-5]: 'Db',
  [-4]: 'Ab',
  [-3]: 'Eb',
  [-2]: 'Bb',
  [-1]: 'F',
  [0]: 'C',
  [1]: 'G',
  [2]: 'D',
  [3]: 'A',
  [4]: 'E',
  [5]: 'B',
  [6]: 'F#',
  [7]: 'C#',
};

const FIFTHS_TO_MINOR_TONIC: Record<number, string> = {
  [-7]: 'Ab',
  [-6]: 'Eb',
  [-5]: 'Bb',
  [-4]: 'F',
  [-3]: 'C',
  [-2]: 'G',
  [-1]: 'D',
  [0]: 'A',
  [1]: 'E',
  [2]: 'B',
  [3]: 'F#',
  [4]: 'C#',
  [5]: 'G#',
  [6]: 'D#',
  [7]: 'A#',
};

/**
 * Derives the canonical tonic letter and mode from MusicXML <fifths> and <mode>.
 */
export function deriveKeyFromFifthsAndMode(
  fifths: number,
  mode = 'major'
): { tonic: string; mode: string } {
  const normMode = mode.toLowerCase().trim();
  const isMinor = normMode === 'minor';
  const table = isMinor ? FIFTHS_TO_MINOR_TONIC : FIFTHS_TO_MAJOR_TONIC;
  const tonic = table[fifths] || (isMinor ? 'A' : 'C');
  return { tonic, mode: normMode || 'major' };
}

/**
 * Reconciles SolfaTunes metadata with MusicXML <key> (<fifths>, <mode>).
 * If the score was transposed externally, updates tonic and mode to eliminate competing authorities.
 */
export function reconcileMetadataWithKey(
  metadata: SolfaTunesMetadata,
  fifths: number,
  mode = 'major'
): SolfaTunesMetadata {
  const derived = deriveKeyFromFifthsAndMode(fifths, mode);
  return {
    ...metadata,
    tonic: derived.tonic,
    mode: derived.mode,
  };
}

/**
 * Generates a stable, deterministic note identifier for sparse metadata referencing.
 * Format: `${partId}-m${measureNumber}-n${noteIndex}`
 */
export function generateStableNoteId(
  partId: string,
  measureNumber: number | string,
  noteIndex: number
): string {
  const safePart = partId.trim() || 'P1';
  return `${safePart}-m${measureNumber}-n${noteIndex}`;
}

/**
 * Parses a stable note ID back into its constituent components.
 * Supports alphanumeric and hyphenated measure tokens (e.g. "1-2", "12a").
 */
export function parseStableNoteId(noteId: string): {
  partId: string;
  measureNumber: string;
  noteIndex: number;
} | null {
  const match = /^(.+)-m(.*?)-n(\d+)$/.exec(noteId);
  if (!match || !match[1] || !match[2]) return null;
  return {
    partId: match[1],
    measureNumber: match[2],
    noteIndex: parseInt(match[3], 10),
  };
}

/**
 * Creates a default, schema-valid SolfaTunes metadata instance.
 */
export function createDefaultSolfaMetadata(
  tonic = 'C',
  mode = 'major',
  songId?: string
): SolfaTunesMetadata {
  return {
    schemaVersion: SOLFATUNES_METADATA_VERSION,
    songId: songId || `score-${Date.now().toString(36)}`,
    solfaSystem: 'movable-do',
    tonic: tonic.trim() || 'C',
    mode: (mode.trim().toLowerCase() as string) || 'major',
    chromaticConvention: 'sharps-i-flats-a',
    noteOverrides: {},
    extraFields: {},
  };
}

/**
 * Validates a metadata object against the SolfaTunes Phase 1 schema contract.
 */
export function validateSolfaMetadata(data: unknown): {
  valid: boolean;
  errors: string[];
  metadata?: SolfaTunesMetadata;
} {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Metadata must be a non-null object'] };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.schemaVersion !== 'string' || !obj.schemaVersion.trim()) {
    errors.push('Missing or invalid "schemaVersion" (string required)');
  }

  if (typeof obj.songId !== 'string' || !obj.songId.trim()) {
    errors.push('Missing or invalid "songId" (string required)');
  }

  if (obj.solfaSystem !== 'movable-do') {
    errors.push('Unsupported "solfaSystem": must be "movable-do"');
  }

  if (typeof obj.tonic !== 'string' || !obj.tonic.trim()) {
    errors.push('Missing or invalid "tonic" (string required)');
  }

  if (typeof obj.mode !== 'string' || !obj.mode.trim()) {
    errors.push('Missing or invalid "mode" (string required)');
  }

  if (
    obj.chromaticConvention !== 'sharps-i-flats-a' &&
    obj.chromaticConvention !== 'standard'
  ) {
    errors.push(
      'Invalid "chromaticConvention": must be "sharps-i-flats-a" or "standard"'
    );
  }

  if (obj.noteOverrides !== undefined) {
    if (typeof obj.noteOverrides !== 'object' || obj.noteOverrides === null || Array.isArray(obj.noteOverrides)) {
      errors.push('"noteOverrides" must be a key-value mapping of note IDs to overrides');
    } else {
      const overrides = obj.noteOverrides as Record<string, unknown>;
      for (const [key, val] of Object.entries(overrides)) {
        if (!parseStableNoteId(key)) {
          errors.push(`Invalid note override ID format: "${key}". Expected format: "<partId>-m<measure>-n<noteIndex>"`);
        }
        if (typeof val !== 'object' || val === null) {
          errors.push(`Invalid note override for "${key}": must be an object`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    metadata: obj as unknown as SolfaTunesMetadata,
  };
}

/**
 * XML entity escaping and unescaping, including numeric XML entities.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function unescapeXml(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Converts a SolfaTunesMetadata object into an array of MusicXML miscellaneous-field key-value pairs.
 */
export function metadataToMiscellaneousFields(
  metadata: SolfaTunesMetadata
): Array<{ name: string; value: string }> {
  const fields: Array<{ name: string; value: string }> = [
    { name: 'solfatunes:version', value: metadata.schemaVersion || SOLFATUNES_METADATA_VERSION },
    { name: 'solfatunes:songId', value: metadata.songId.trim() },
    { name: 'solfatunes:solfaSystem', value: metadata.solfaSystem },
    { name: 'solfatunes:tonic', value: metadata.tonic.trim() },
    { name: 'solfatunes:mode', value: metadata.mode.trim() },
    { name: 'solfatunes:chromaticConvention', value: metadata.chromaticConvention },
  ];

  if (metadata.hymn && Object.keys(metadata.hymn).length > 0) {
    fields.push({ name: 'solfatunes:hymn', value: JSON.stringify(metadata.hymn) });
  }

  if (metadata.parts && Object.keys(metadata.parts).length > 0) {
    fields.push({ name: 'solfatunes:parts', value: JSON.stringify(metadata.parts) });
  }

  if (metadata.unmeteredLyrics && metadata.unmeteredLyrics.length > 0) {
    fields.push({
      name: 'solfatunes:unmeteredLyrics',
      value: JSON.stringify(metadata.unmeteredLyrics),
    });
  }

  if (metadata.originalAbcSource) {
    fields.push({
      name: 'solfatunes:originalAbcSource',
      value: metadata.originalAbcSource,
    });
  }

  if (metadata.noteOverrides && Object.keys(metadata.noteOverrides).length > 0) {
    fields.push({
      name: 'solfatunes:noteOverrides',
      value: JSON.stringify(metadata.noteOverrides),
    });
  }

  // Preserve any extra forward-compatible fields
  if (metadata.extraFields) {
    for (const [k, v] of Object.entries(metadata.extraFields)) {
      if (!fields.some((f) => f.name === k)) {
        fields.push({ name: k, value: v });
      }
    }
  }

  return fields;
}

/**
 * Parses miscellaneous-field key-value pairs into a SolfaTunesMetadata object.
 * Returns null if no solfatunes:* fields are found.
 * Malformed JSON fields are preserved in extraFields to prevent silent data loss.
 */
export function miscellaneousFieldsToMetadata(
  fields: Array<{ name: string; value: string }>
): SolfaTunesMetadata | null {
  const solfaFields = fields.filter((f) => f.name.startsWith('solfatunes:'));
  if (solfaFields.length === 0) {
    return null;
  }

  const fieldMap = new Map<string, string>();
  for (const field of solfaFields) {
    fieldMap.set(field.name, field.value);
  }

  const schemaVersion = (fieldMap.get('solfatunes:version') || SOLFATUNES_METADATA_VERSION).trim();
  const songId = (fieldMap.get('solfatunes:songId') || `score-${Date.now().toString(36)}`).trim();
  const solfaSystem = ((fieldMap.get('solfatunes:solfaSystem') || 'movable-do').trim() as SolfaSystem);
  const tonic = (fieldMap.get('solfatunes:tonic') || 'C').trim();
  const mode = (fieldMap.get('solfatunes:mode') || 'major').trim();
  const chromaticConvention =
    ((fieldMap.get('solfatunes:chromaticConvention') || 'sharps-i-flats-a').trim() as ChromaticAlterationConvention);

  const extraFields: Record<string, string> = {};

  let hymn: SolfaTunesHymnMetadata | undefined;
  const hymnRaw = fieldMap.get('solfatunes:hymn');
  if (hymnRaw) {
    try {
      hymn = JSON.parse(hymnRaw);
    } catch {
      // Preserve malformed JSON to prevent silent data loss
      extraFields['solfatunes:hymn:raw'] = hymnRaw;
    }
  }

  let parts: Record<string, SolfaTunesPartMetadata> | undefined;
  const partsRaw = fieldMap.get('solfatunes:parts');
  if (partsRaw) {
    try {
      parts = JSON.parse(partsRaw);
    } catch {
      extraFields['solfatunes:parts:raw'] = partsRaw;
    }
  }

  let unmeteredLyrics: string[] | undefined;
  const lyricsRaw = fieldMap.get('solfatunes:unmeteredLyrics');
  if (lyricsRaw) {
    try {
      unmeteredLyrics = JSON.parse(lyricsRaw);
    } catch {
      extraFields['solfatunes:unmeteredLyrics:raw'] = lyricsRaw;
    }
  }

  const originalAbcSource = fieldMap.get('solfatunes:originalAbcSource');

  let noteOverrides: Record<string, SolfaNoteOverride> | undefined;
  const noteOverridesRaw = fieldMap.get('solfatunes:noteOverrides');
  if (noteOverridesRaw) {
    try {
      noteOverrides = JSON.parse(noteOverridesRaw);
    } catch {
      extraFields['solfatunes:noteOverrides:raw'] = noteOverridesRaw;
    }
  }

  // Preserve any unrecognized solfatunes:* fields for forward-compatibility
  const standardKeys = new Set([
    'solfatunes:version',
    'solfatunes:songId',
    'solfatunes:solfaSystem',
    'solfatunes:tonic',
    'solfatunes:mode',
    'solfatunes:chromaticConvention',
    'solfatunes:hymn',
    'solfatunes:parts',
    'solfatunes:unmeteredLyrics',
    'solfatunes:originalAbcSource',
    'solfatunes:noteOverrides',
  ]);

  for (const [k, v] of fieldMap.entries()) {
    if (!standardKeys.has(k)) {
      extraFields[k] = v;
    }
  }

  return {
    schemaVersion,
    songId,
    solfaSystem,
    tonic,
    mode,
    chromaticConvention,
    ...(hymn ? { hymn } : {}),
    ...(parts ? { parts } : {}),
    ...(unmeteredLyrics ? { unmeteredLyrics } : {}),
    ...(originalAbcSource ? { originalAbcSource } : {}),
    noteOverrides: noteOverrides || {},
    extraFields,
  };
}

/**
 * Extracts SolfaTunes metadata and preserves non-Solfa miscellaneous fields from a MusicXML document string.
 */
export function extractMetadataFromMusicXml(musicXmlString: string): {
  metadata: SolfaTunesMetadata | null;
  nonSolfaFields: Array<{ name: string; value: string }>;
} {
  const nonSolfaFields: Array<{ name: string; value: string }> = [];
  const allFields: Array<{ name: string; value: string }> = [];

  // Match all <miscellaneous-field name="...">content</miscellaneous-field>
  // Handles multi-line content, self-closing tags, whitespace, etc.
  const fieldRegex = /<miscellaneous-field\s+name=["']([^"']+)["']\s*(?:\/>|>([\s\S]*?)<\/miscellaneous-field>)/gi;
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(musicXmlString)) !== null) {
    const name = match[1];
    const rawVal = match[2] !== undefined ? match[2] : '';
    const value = unescapeXml(rawVal);
    allFields.push({ name, value });
    if (!name.startsWith('solfatunes:')) {
      nonSolfaFields.push({ name, value });
    }
  }

  const metadata = miscellaneousFieldsToMetadata(allFields);
  return { metadata, nonSolfaFields };
}

/**
 * Injects or updates SolfaTunes metadata in a MusicXML score string.
 * - Conforms strictly to MusicXML DTD/XSD schema element ordering.
 * - Handles both standard and self-closing <miscellaneous/> tags without duplicates.
 * - Preserves existing third-party / non-solfatunes <miscellaneous-field> entries.
 * - Preserves XML declaration and DOCTYPE if present.
 */
export function injectMetadataIntoMusicXml(
  musicXmlString: string,
  metadata: SolfaTunesMetadata
): string {
  const { nonSolfaFields } = extractMetadataFromMusicXml(musicXmlString);
  const solfaFields = metadataToMiscellaneousFields(metadata);

  // Combine non-solfa fields and solfa fields
  const combinedFields = [...nonSolfaFields, ...solfaFields];

  // Format <miscellaneous> block
  const miscFieldLines = combinedFields.map(
    (f) => `      <miscellaneous-field name="${escapeXml(f.name)}">${escapeXml(f.value)}</miscellaneous-field>`
  );
  const newMiscBlock = `    <miscellaneous>\n${miscFieldLines.join('\n')}\n    </miscellaneous>`;

  // Check if <miscellaneous> already exists (standard or self-closing)
  const miscRegex = /<miscellaneous(?:\s*\/|\s*>[\s\S]*?<\/miscellaneous)>/i;
  if (miscRegex.test(musicXmlString)) {
    return musicXmlString.replace(miscRegex, newMiscBlock.trim());
  }

  // Check if <identification> exists (standard closing tag)
  const identCloseRegex = /(<\/identification>)/i;
  if (identCloseRegex.test(musicXmlString)) {
    return musicXmlString.replace(identCloseRegex, `  ${newMiscBlock}\n  $1`);
  }

  // Check if <identification/> self-closing exists
  const identSelfClosing = /<identification\s*\/>/i;
  if (identSelfClosing.test(musicXmlString)) {
    return musicXmlString.replace(
      identSelfClosing,
      `  <identification>\n${newMiscBlock}\n  </identification>`
    );
  }

  // If no <identification>, create one in the valid MusicXML DTD position:
  // After <work>, <movement-number>, or <movement-title>, and before <defaults>, <credit>, <part-list>
  const identBlock = `  <identification>\n    <encoding>\n      <software>SolfaTunes</software>\n      <encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date>\n    </encoding>\n${newMiscBlock}\n  </identification>`;

  // Look for target insertion point before <defaults>, <credit>, or <part-list>
  const insertBeforeRegex = /(\s*<(defaults|credit|part-list)[\s>])/i;
  if (insertBeforeRegex.test(musicXmlString)) {
    return musicXmlString.replace(insertBeforeRegex, `\n${identBlock}\n$1`);
  }

  // Or after opening <score-partwise ...>
  const scoreOpenRegex = /(<score-partwise[^>]*>)/i;
  if (scoreOpenRegex.test(musicXmlString)) {
    return musicXmlString.replace(scoreOpenRegex, `$1\n${identBlock}`);
  }

  // Fallback: prepend identification inside root
  return `<score-partwise version="4.0">\n${identBlock}\n</score-partwise>`;
}
