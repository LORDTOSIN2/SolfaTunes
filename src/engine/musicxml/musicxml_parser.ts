/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore, System, VoiceLine, Measure, SolfaNote, VoiceDeclaration } from '../../types';
import {
  SolfaTunesMetadata,
  extractMetadataFromMusicXml,
  deriveKeyFromFifthsAndMode,
  reconcileMetadataWithKey,
  generateStableNoteId,
  SOLFATUNES_VOICE_ID_MAP_FIELD,
} from './schema';
import { LossinessReport, createEmptyLossinessReport } from './lossiness_report';
import { parseXml, XmlElement } from './xml_utils';
import { createMusicalDocument, MusicalDocument } from '../musical_document';
import {
  basePitchClass,
  getKeyInfo,
  calculatePitchClass,
  calculateScaleDegree,
  scaleDegreeToSyllable,
  pitchClassToSolfaSyllable,
  calculateMidiPitch,
  calculateSolfaOctave,
} from '../solfa_semantics';
import { SolfaTransformer } from '../solfa_transformer';

export class MusicXmlParseError extends Error {
  constructor(message: string, public readonly report: LossinessReport) {
    super(message);
    this.name = 'MusicXmlParseError';
  }
}

function parsePositiveNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getMetronomeQuarterBpm(direction: XmlElement): number | undefined {
  const metronome = direction.findChild('direction-type')?.findChild('metronome');
  if (!metronome) return undefined;

  const perMinute = parsePositiveNumber(metronome.getChildText('per-minute'));
  const beatUnit = metronome.getChildText('beat-unit')?.toLowerCase();
  const beatUnitQuarterLength: Record<string, number> = {
    maxima: 32,
    long: 16,
    breve: 8,
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    '16th': 0.25,
    '32nd': 0.125,
    '64th': 0.0625,
    '128th': 0.03125,
    '256th': 0.015625,
  };
  const quarterLength = beatUnit ? beatUnitQuarterLength[beatUnit] : undefined;
  if (!perMinute || quarterLength === undefined) return undefined;

  const dots = metronome.findChildren('beat-unit-dot').length;
  const dotMultiplier = dots === 0 ? 1 : 2 - 1 / 2 ** dots;
  return perMinute * quarterLength * dotMultiplier;
}

function getDirectionTempo(direction: XmlElement): {
  hasTempoMarking: boolean;
  bpm?: number;
} {
  const soundTempoText = direction.findChild('sound')?.attrs['tempo'];
  const soundTempo = parsePositiveNumber(soundTempoText);
  const metronome = direction.findChild('direction-type')?.findChild('metronome');
  const hasTempoMarking = soundTempoText !== undefined || Boolean(metronome);
  return {
    hasTempoMarking,
    bpm: soundTempo ?? getMetronomeQuarterBpm(direction),
  };
}

export interface MusicXmlParseResult {
  score: ParsedScore;
  metadata: SolfaTunesMetadata | null;
  report: LossinessReport;
}

/**
 * Parses a MusicXML string into a SolfaTunes ParsedScore.
 *
 * GUARANTEES:
 * 1. Supports one-voice-per-part scores. Emits explicit warnings for multi-voice staves / backup tags.
 * 2. Preserves explicit Sol-fa syllables via noteOverrides with isExplicit=true (no silent re-derivation).
 * 3. Handles mid-score key changes by applying the first key and logging a lossiness warning.
 * 4. Fails safely on malformed XML with clear errors.
 */
export class MusicXmlParser {
  public static parse(xmlString: string): MusicXmlParseResult {
    const report = createEmptyLossinessReport();

    // 1. Parse XML into element tree safely
    let root: XmlElement;
    try {
      root = parseXml(xmlString);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      report.errors.push(`XML syntax error: ${errMsg}`);
      report.isLossless = false;
      throw new MusicXmlParseError(`Failed to parse MusicXML: ${errMsg}`, report);
    }

    if (root.tag.toLowerCase() !== 'score-partwise') {
      const err = `Expected root element <score-partwise>, found <${root.tag}>`;
      report.errors.push(err);
      report.isLossless = false;
      throw new MusicXmlParseError(err, report);
    }

    // 2. Extract SolfaTunes metadata if present
    let { metadata } = extractMetadataFromMusicXml(xmlString);

    // 3. Work & Movement Title
    const work = root.findChild('work');
    const workTitle = work ? work.getChildText('work-title') : undefined;
    const movementTitle = root.getChildText('movement-title');
    const title = movementTitle || workTitle || (metadata?.hymn?.hymnName) || (metadata?.hymn?.tuneName) || 'Untitled';

    // 4. Composer
    let composer = 'Composer unknown';
    const identification = root.findChild('identification');
    if (identification) {
      const creators = identification.findChildren('creator');
      const compEl = creators.find((c) => (c.attrs['type'] || '').toLowerCase() === 'composer');
      if (compEl && compEl.text) {
        composer = compEl.text.trim();
      } else if (creators.length > 0 && creators[0].text) {
        composer = creators[0].text.trim();
      }
    }

    // 5. Part List
    const partListEl = root.findChild('part-list');
    if (!partListEl) {
      const err = 'Missing <part-list> element in <score-partwise>';
      report.errors.push(err);
      report.isLossless = false;
      throw new MusicXmlParseError(err, report);
    }

    const scorePartEls = partListEl.findChildren('score-part');
    if (scorePartEls.length === 0) {
      const err = 'No <score-part> elements found in <part-list>';
      report.errors.push(err);
      report.isLossless = false;
      throw new MusicXmlParseError(err, report);
    }

    let voiceIdMap: Record<string, string> = {};
    const rawVoiceIdMap = metadata?.extraFields?.[SOLFATUNES_VOICE_ID_MAP_FIELD];
    if (rawVoiceIdMap) {
      try {
        const parsed: unknown = JSON.parse(rawVoiceIdMap);
        if (
          parsed &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          Object.values(parsed).every(value => typeof value === 'string' && value.length > 0) &&
          new Set(Object.values(parsed)).size === Object.values(parsed).length
        ) {
          voiceIdMap = parsed as Record<string, string>;
        } else {
          throw new Error('Invalid voice ID mapping shape.');
        }
      } catch {
        report.warnings.push('SolfaTunes voice ID mapping could not be read; MusicXML part IDs were used.');
        report.unsupportedConstructs.push('Invalid SolfaTunes voice ID mapping');
        report.isLossless = false;
      }
    }

    const xmlPartIdToVoiceId = new Map<string, string>();
    const voices: VoiceDeclaration[] = scorePartEls.map((sp, idx) => {
      const xmlPartId = sp.attrs['id'] || `P${idx + 1}`;
      const id = Object.hasOwn(voiceIdMap, xmlPartId) ? voiceIdMap[xmlPartId] : xmlPartId;
      xmlPartIdToVoiceId.set(xmlPartId, id);
      const name = sp.getChildText('part-name') || id;
      return {
        id,
        name,
        clef: 'treble', // Will be updated if part defines a clef
        order: idx,
      };
    });

    // 6. Find all <part> elements
    const partEls = root.findChildren('part');
    const partMap = new Map<string, XmlElement>();
    partEls.forEach((p) => {
      const xmlPartId = p.attrs['id'];
      if (xmlPartId) {
        partMap.set(xmlPartIdToVoiceId.get(xmlPartId) || xmlPartId, p);
      }
    });

    // 7. Track global musical attributes
    let initialKey = metadata?.tonic || 'C';
    let initialMode = metadata?.mode || 'major';
    let initialKeySignatureFifths: number | null = null;
    let initialKeySignatureMode: string | null = null;
    let initialTempoBpm: number | undefined;

    let meter = '4/4';
    let initialMeterFound = false;
    let hasUnsupportedTempoMarking = false;
    let hasTempoChange = false;
    const measureDivisionsByVoice: Record<string, number[]> = {};

    // Check all measures across parts to detect initial and mid-score key changes,
    // and multi-voice polyphony (<backup> and multiple <voice> tags)
    for (const voice of voices) {
      const partEl = partMap.get(voice.id);
      if (!partEl) continue;

      const measureEls = partEl.findChildren('measure');
      let currentDivisions = 4;
      measureDivisionsByVoice[voice.id] = [];
      for (const mEl of measureEls) {
        const mNum = mEl.attrs['number'] || '1';

        for (const direction of mEl.findChildren('direction')) {
          const tempo = getDirectionTempo(direction);
          if (tempo.hasTempoMarking && tempo.bpm === undefined) {
            hasUnsupportedTempoMarking = true;
          } else if (tempo.bpm !== undefined) {
            if (initialTempoBpm === undefined) {
              initialTempoBpm = tempo.bpm;
            } else if (Math.abs(initialTempoBpm - tempo.bpm) > 0.01) {
              hasTempoChange = true;
            }
          }
        }

        if (hasUnsupportedTempoMarking && !report.unsupportedConstructs.includes('Tempo markings')) {
          report.warnings.push(
            `Part "${voice.id}" measure ${mNum} contains a tempo marking that cannot be interpreted as a numeric quarter-note tempo. It was not applied to playback.`
          );
          report.unsupportedConstructs.push('Tempo markings');
          report.isLossless = false;
        }
        if (hasTempoChange && !report.unsupportedConstructs.includes('Tempo changes')) {
          report.warnings.push(
            `Part "${voice.id}" measure ${mNum} contains a tempo change. SolfaTunes currently applies only the initial tempo of ${initialTempoBpm} BPM.`
          );
          report.unsupportedConstructs.push('Tempo changes');
          report.isLossless = false;
        }

        const hasUnrepresentedDirection = mEl.findChildren('direction').some((direction) =>
          direction.findChild('direction-type')?.children.some(
            element => element.tag.toLowerCase() !== 'metronome'
          )
        );
        if (hasUnrepresentedDirection && !report.unsupportedConstructs.includes('Direction markings')) {
          report.warnings.push(
            `Part "${voice.id}" measure ${mNum} contains direction text or expressive markings that are not retained.`
          );
          report.unsupportedConstructs.push('Direction markings');
          report.isLossless = false;
        }

        // Check for backup tags (Requirement 1)
        const backups = mEl.findChildren('backup');
        if (backups.length > 0) {
          report.warnings.push(
            `Part "${voice.id}" measure ${mNum} contains <backup> elements (multi-voice polyphony). Secondary voice layers are unsupported in SolfaTunes and were skipped.`
          );
          report.unsupportedConstructs.push('Polyphonic <backup> elements');
          report.isLossless = false;
        }

        if (
          mEl.findChildren('forward').length > 0 &&
          !report.unsupportedConstructs.includes('Forward elements')
        ) {
          report.warnings.push(
            `Part "${voice.id}" measure ${mNum} contains <forward> elements. Skipped rhythmic positions are not represented in the imported score.`
          );
          report.unsupportedConstructs.push('Forward elements');
          report.isLossless = false;
        }

        // Check for multi-voice notes in the same part (Requirement 1)
        const notes = mEl.findChildren('note');
        const voiceNumbers = new Set<string>();
        notes.forEach((n) => {
          const v = n.getChildText('voice');
          if (v) voiceNumbers.add(v);
        });
        if (voiceNumbers.size > 1) {
          report.warnings.push(
            `Part "${voice.id}" measure ${mNum} contains multiple voice numbers (${Array.from(voiceNumbers).join(', ')}). SolfaTunes expects one voice per part; secondary voices were filtered.`
          );
          report.unsupportedConstructs.push('Multi-voice staves');
          report.isLossless = false;
        }

        // Check attributes for key, time, divisions, clef
        for (const attrsEl of mEl.findChildren('attributes')) {
          const divText = attrsEl.getChildText('divisions');
          if (divText) {
            currentDivisions = parseInt(divText, 10) || 4;
          }

          const timeEl = attrsEl.findChild('time');
          if (timeEl) {
            const beats = timeEl.getChildText('beats') || '4';
            const beatType = timeEl.getChildText('beat-type') || '4';
            const currentMeter = `${beats}/${beatType}`;
            if (
              (timeEl.findChildren('beats').length !== 1 ||
                beats.includes('+') ||
                timeEl.findChild('senza-misura')) &&
              !report.unsupportedConstructs.includes('Complex meters')
            ) {
              report.warnings.push(
                `Part "${voice.id}" measure ${mNum} contains a complex or unmetered time signature. Only simple numeric meters are represented.`
              );
              report.unsupportedConstructs.push('Complex meters');
              report.isLossless = false;
            }
            if (!initialMeterFound) {
              meter = currentMeter;
              initialMeterFound = true;
            } else if (
              currentMeter !== meter &&
              !report.unsupportedConstructs.includes('Mid-score meter changes')
            ) {
              report.warnings.push(
                `Mid-score meter change detected at measure ${mNum} (${currentMeter}). SolfaTunes currently supports one global meter; initial meter "${meter}" was retained.`
              );
              report.unsupportedConstructs.push('Mid-score meter changes');
              report.isLossless = false;
            }
          }

          if (
            attrsEl.findChild('transpose') &&
            !report.unsupportedConstructs.includes('Transposing instruments')
          ) {
            report.warnings.push(
              `Part "${voice.id}" measure ${mNum} contains a transposition setting. Written and sounding pitch are not reconciled; written pitches are used for playback.`
            );
            report.unsupportedConstructs.push('Transposing instruments');
            report.isLossless = false;
          }

          const clefEl = attrsEl.findChild('clef');
          if (clefEl) {
            const sign = (clefEl.getChildText('sign') || 'G').toUpperCase();
            if (sign === 'F') voice.clef = 'bass';
            else if (sign === 'C') voice.clef = 'alto';
            else voice.clef = 'treble';
          }

          const keyEl = attrsEl.findChild('key');
          if (keyEl) {
            const fifthsText = keyEl.getChildText('fifths');
            const modeText = keyEl.getChildText('mode') || metadata?.mode || 'major';
            if (
              fifthsText === undefined &&
              !report.unsupportedConstructs.includes('Non-traditional key signatures')
            ) {
              report.warnings.push(
                `Part "${voice.id}" measure ${mNum} contains a key signature without <fifths>. Non-traditional key signatures are not represented.`
              );
              report.unsupportedConstructs.push('Non-traditional key signatures');
              report.isLossless = false;
            } else if (fifthsText !== undefined) {
              const fifths = parseInt(fifthsText, 10);
              const derived = deriveKeyFromFifthsAndMode(fifths, modeText);

              if (initialKeySignatureFifths === null) {
                initialKeySignatureFifths = fifths;
                initialKeySignatureMode = derived.mode;
                initialKey = derived.tonic;
                initialMode = derived.mode;
                if (metadata) {
                  metadata = reconcileMetadataWithKey(metadata, fifths, derived.mode);
                }
                if (
                  derived.mode !== 'major' &&
                  derived.mode !== 'minor' &&
                  !report.unsupportedConstructs.includes('Non-major/minor modes')
                ) {
                  report.warnings.push(
                    `MusicXML mode "${modeText}" is not represented by SolfaTunes scoring semantics and was interpreted using the key signature's major-key mapping.`
                  );
                  report.unsupportedConstructs.push('Non-major/minor modes');
                  report.isLossless = false;
                }
              } else if (
                initialKeySignatureFifths !== fifths ||
                initialKeySignatureMode !== derived.mode
              ) {
                // Mid-score key change detected (Requirement 3)
                report.warnings.push(
                  `Mid-score key change detected at measure ${mNum} (fifths: ${fifths}, mode: ${modeText}). SolfaTunes currently supports a single global key; initial key "${initialKey}" was retained.`
                );
                report.unsupportedConstructs.push('Mid-score key changes');
                report.isLossless = false;
              }
            }
            measureDivisionsByVoice[voice.id].push(currentDivisions);
          }
        }
      }
    }

    const keyInfo = getKeyInfo(initialKey);
    const keyDefaultAccs = keyInfo.sharpsFlats !== undefined ? getKeyInfo(initialKey) : { tonic: 0, sharpsFlats: 0 };

    // 8. Parse measures per voice and distribute into Systems
    // Detect system breaks (<print new-system="yes"/>)
    const systemMeasuresMap: Array<{ [voiceId: string]: Measure }> = [];
    const systemBarTypesMap: Array<{ [voiceId: string]: string[] }> = [];

    // First, collect measures for each voice
    const voiceMeasures: { [voiceId: string]: Measure[] } = {};
    const voiceBarTypes: { [voiceId: string]: string[] } = {};
    const systemBreakIndices = new Set<number>(); // Measure indices (0-based) that start a new system

    voices.forEach((voice) => {
      voiceMeasures[voice.id] = [];
      voiceBarTypes[voice.id] = [];

      const partEl = partMap.get(voice.id);
      if (!partEl) return;

      const measureEls = partEl.findChildren('measure');
      measureEls.forEach((mEl, mIndex) => {
        const mNum = mEl.attrs['number'] || `${mIndex + 1}`;

        // Check for new-system print directive (primary voice only)
        if (voice.id === voices[0].id) {
          const printEl = mEl.findChild('print');
          if (printEl && (printEl.attrs['new-system'] === 'yes' || printEl.attrs['new-page'] === 'yes')) {
            if (mIndex > 0) {
              systemBreakIndices.add(mIndex);
            }
          }
        }

        // Active overrides for explicit accidentals within the measure
        const activeOverrides: { [letter: string]: number } = {};
        const parsedNotes: SolfaNote[] = [];
        const rawNoteTokens: string[] = [];

        // Determine primary voice number
        const noteEls = mEl.findChildren('note');
        let primaryVoice = '1';
        if (noteEls.length > 0) {
          primaryVoice = noteEls[0].getChildText('voice') || '1';
        }

        let noteIdxInMeasure = 0;
        for (const nEl of noteEls) {
          const noteHasTie = nEl.findChildren('tie').length > 0 ||
            (nEl.findChild('notations')?.findChildren('tied').length || 0) > 0;
          if (noteHasTie && !report.unsupportedConstructs.includes('Ties')) {
            report.warnings.push(
              `Part "${voice.id}" measure ${mNum} contains a tie. Ties are not represented in the imported score.`
            );
            report.unsupportedConstructs.push('Ties');
            report.isLossless = false;
          }

          const unsupportedNotations = nEl.findChild('notations')?.children.filter(
            element => element.tag.toLowerCase() !== 'tied'
          ) || [];
          if (unsupportedNotations.length > 0 && !report.unsupportedConstructs.includes('Note notations')) {
            const notationNames = [...new Set(unsupportedNotations.map(element => element.tag))].join(', ');
            report.warnings.push(
              `Part "${voice.id}" measure ${mNum} contains unsupported note notation (${notationNames}) that is not retained.`
            );
            report.unsupportedConstructs.push('Note notations');
            report.isLossless = false;
          }

          if (nEl.findChildren('lyric').length > 0 &&
            !report.unsupportedConstructs.includes('Note-aligned lyrics')) {
            report.warnings.push(
              `Part "${voice.id}" measure ${mNum} contains note-aligned lyrics. The imported score only retains unmetered lyrics.`
            );
            report.unsupportedConstructs.push('Note-aligned lyrics');
            report.isLossless = false;
          }

          // If note belongs to a secondary voice on a multi-voice staff, skip it
          const noteVoice = nEl.getChildText('voice');
          if (noteVoice && noteVoice !== primaryVoice) {
            continue;
          }

          if (nEl.findChild('grace')) {
            if (!report.unsupportedConstructs.includes('Grace notes')) {
              report.warnings.push(
                `Part "${voice.id}" measure ${mNum} contains a grace note. Grace notes are not represented in the imported score and were skipped.`
              );
              report.unsupportedConstructs.push('Grace notes');
              report.isLossless = false;
            }
            noteIdxInMeasure++;
            continue;
          }

          if (nEl.findChild('unpitched')) {
            if (!report.unsupportedConstructs.includes('Unpitched notes')) {
              report.warnings.push(
                `Part "${voice.id}" measure ${mNum} contains an unpitched note. Unpitched notes are not represented in the imported score and were skipped.`
              );
              report.unsupportedConstructs.push('Unpitched notes');
              report.isLossless = false;
            }
            noteIdxInMeasure++;
            continue;
          }

          // If note is part of a chord cluster (not first note), skip or report
          if (nEl.findChild('chord')) {
            report.warnings.push(
              `Chord cluster note detected in Part "${voice.id}" measure ${mNum}. SolfaTunes is monophonic per voice; chord note skipped.`
            );
            report.unsupportedConstructs.push('Chord clusters');
            report.isLossless = false;
            continue;
          }

          const durationText = nEl.getChildText('duration');
          const divisions = measureDivisionsByVoice[voice.id]?.[mIndex] || 4;
          const rawDuration = durationText ? parseInt(durationText, 10) : divisions;
          // MusicXML duration is expressed in divisions, where one quarter note
          // is the current <divisions> value. The transformer converts it to ticks.
          const durationMult = rawDuration / divisions;

          const stableId = generateStableNoteId(voice.id, mNum, noteIdxInMeasure);
          const override = metadata?.noteOverrides?.[stableId];

          const isRest = Boolean(nEl.findChild('rest'));

          if (isRest) {
            parsedNotes.push({
              syllable: '·',
              scaleDegree: 0,
              midiPitch: 0,
              octaveRelativeToVoice: 0,
              durationTicks: durationMult,
              isRest: true,
              timestamp: 0,
              rawLetter: 'z',
            });
            rawNoteTokens.push(`z${durationMult !== 1 ? durationMult : ''}`);
          } else {
            const pitchEl = nEl.findChild('pitch');
            const step = (pitchEl ? pitchEl.getChildText('step') : undefined) || 'C';
            const alterText = pitchEl ? pitchEl.getChildText('alter') : undefined;
            const accidentalText = nEl.getChildText('accidental');
            let alter = alterText !== undefined ? parseInt(alterText, 10) : undefined;

            let rawAcc: string | undefined;
            if (accidentalText === 'natural' || (alterText !== undefined && alter === 0)) {
              rawAcc = '=';
              alter = 0;
            } else if (alter === 1 || accidentalText === 'sharp') {
              rawAcc = '^';
              alter = 1;
            } else if (alter === 2 || accidentalText === 'double-sharp') {
              rawAcc = '^^';
              alter = 2;
            } else if (alter === -1 || accidentalText === 'flat') {
              rawAcc = '_';
              alter = -1;
            } else if (alter === -2 || accidentalText === 'flat-flat') {
              rawAcc = '__';
              alter = -2;
            } else {
              alter = keyDefaultAccs[step] || 0;
            }

            const octaveText = pitchEl ? pitchEl.getChildText('octave') : undefined;
            const octave = octaveText !== undefined ? parseInt(octaveText, 10) : 4;

            const pc = calculatePitchClass(step, alter);
            const midiPitch = calculateMidiPitch(octave, pc);
            const deg = calculateScaleDegree(pc, keyInfo.tonic);

            // Requirement 2: Preserve explicit Sol-fa syllables via noteOverrides with isExplicit=true
            let syllable: string;
            let scaleDegree: number;

            if (override && override.isExplicit && override.syllable) {
              syllable = override.syllable;
              scaleDegree = override.scaleDegree ?? deg;
            } else if (override && override.syllable) {
              syllable = override.syllable;
              scaleDegree = override.scaleDegree ?? deg;
            } else {
              // Mathematical Movable-Do derivation
              syllable = scaleDegreeToSyllable(deg);
              scaleDegree = deg;
            }

            parsedNotes.push({
              syllable,
              scaleDegree,
              midiPitch,
              octaveRelativeToVoice: 0,
              durationTicks: durationMult,
              isRest: false,
              timestamp: 0,
              rawLetter: step,
              rawAccidental: rawAcc,
              octaveNum: octave,
            });
            rawNoteTokens.push(`${rawAcc || ''}${step}${durationMult !== 1 ? durationMult : ''}`);
          }

          noteIdxInMeasure++;
        }

        // Determine barline type
        let barType = '|';
        const barlineEl = mEl.findChild('barline');
        if (barlineEl) {
          const barStyle = barlineEl.getChildText('bar-style');
          if (barStyle === 'light-heavy') barType = '|]';
          else if (barStyle === 'light-light') barType = '||';
        }

        voiceMeasures[voice.id].push({
          notes: parsedNotes,
          rawText: rawNoteTokens.join(' '),
        });
        voiceBarTypes[voice.id].push(barType);
      });
    });

    // 9. Split measures across systems
    const systems: System[] = [];
    const preservedCounts = metadata?.hymn?.systemVoiceMeasureCounts;

    if (preservedCounts && Object.keys(preservedCounts).length > 0) {
      // Determine number of systems from preserved counts
      const numSystems = Math.max(...Object.values(preservedCounts).map((c) => c.length));
      const voiceOffsets: { [voiceId: string]: number } = {};
      voices.forEach((v) => (voiceOffsets[v.id] = 0));

      for (let sIdx = 0; sIdx < numSystems; sIdx++) {
        const systemVoices: { [voiceId: string]: VoiceLine } = {};
        voices.forEach((v) => {
          const vMeasures = voiceMeasures[v.id] || [];
          const vBarTypes = voiceBarTypes[v.id] || [];
          const count = preservedCounts[v.id]?.[sIdx] ?? vMeasures.length;
          const start = voiceOffsets[v.id] || 0;
          const end = start + count;
          voiceOffsets[v.id] = end;

          systemVoices[v.id] = {
            voiceId: v.id,
            measures: vMeasures.slice(start, end),
            barTypes: vBarTypes.slice(start, end),
          };
        });

        systems.push({
          systemIndex: sIdx,
          voices: systemVoices,
        });
      }
    } else {
      // Fallback: Group measures into systems based on primary voice systemBreakIndices
      const numMeasures = Math.max(0, ...Object.values(voiceMeasures).map((m) => m.length));
      let currentSystemStart = 0;
      const breakPoints = Array.from(systemBreakIndices).sort((a, b) => a - b);
      breakPoints.push(numMeasures); // Final boundary

      breakPoints.forEach((breakEnd) => {
        if (breakEnd <= currentSystemStart) return;

        const systemVoices: { [voiceId: string]: VoiceLine } = {};
        voices.forEach((v) => {
          const vMeasures = voiceMeasures[v.id] || [];
          const vBarTypes = voiceBarTypes[v.id] || [];

          systemVoices[v.id] = {
            voiceId: v.id,
            measures: vMeasures.slice(currentSystemStart, breakEnd),
            barTypes: vBarTypes.slice(currentSystemStart, breakEnd),
          };
        });

        systems.push({
          systemIndex: systems.length,
          voices: systemVoices,
        });

        currentSystemStart = breakEnd;
      });
    }

    // If no systems were created, create at least one empty system
    if (systems.length === 0) {
      const systemVoices: { [voiceId: string]: VoiceLine } = {};
      voices.forEach((v) => {
        systemVoices[v.id] = {
          voiceId: v.id,
          measures: [],
          barTypes: [],
        };
      });
      systems.push({ systemIndex: 0, voices: systemVoices });
    }

    // 10. Assemble ParsedScore
    const parsedScore: ParsedScore = {
      title,
      composer,
      key: initialMode === 'minor' ? `${initialKey}m` : initialKey,
      meter,
      tempoBpm: initialTempoBpm,
      defaultLength: '1/4',
      index: metadata?.songId ? metadata.songId.replace(/^score-/, '') : '1',
      voices,
      voicePairingGroups: metadata?.hymn?.voicePairingGroups || [['S', 'A'], ['T', 'B']],
      systems,
      hymnMeter: metadata?.hymn?.hymnMeter,
      tuneName: metadata?.hymn?.tuneName,
      hymnName: metadata?.hymn?.hymnName,
      verses: metadata?.hymn?.verses,
      hasDescant: metadata?.hymn?.hasDescant,
      lyrics: metadata?.unmeteredLyrics,
    };

    // 11. Run transformer to synchronize timeline timestamps and voice home registers
    const transformer = new SolfaTransformer();
    const transformedScore = transformer.transform(parsedScore);

    // Re-apply any explicit syllable overrides after transformation
    // (guaranteeing that transformer's default calculations never overwrite explicit minor/chromatic syllables)
    if (metadata?.noteOverrides) {
      const voiceGlobalMeasureCount: { [voiceId: string]: number } = {};
      transformedScore.systems.forEach((system) => {
        transformedScore.voices.forEach((voice) => {
          if (!voiceGlobalMeasureCount[voice.id]) voiceGlobalMeasureCount[voice.id] = 0;
          const vLine = system.voices[voice.id];
          if (!vLine) return;

          vLine.measures.forEach((m) => {
            voiceGlobalMeasureCount[voice.id]++;
            const mNum = voiceGlobalMeasureCount[voice.id];
            m.notes.forEach((note, nIdx) => {
              const stableId = generateStableNoteId(voice.id, mNum, nIdx);
              const override = metadata.noteOverrides?.[stableId];
              if (override && override.isExplicit && override.syllable) {
                note.syllable = override.syllable;
                if (override.scaleDegree !== undefined) {
                  note.scaleDegree = override.scaleDegree;
                }
              }
            });
          });
        });
      });
    }

    return {
      score: transformedScore,
      metadata,
      report,
    };
  }
}

export function parseMusicXmlToScore(xmlString: string): MusicXmlParseResult {
  return MusicXmlParser.parse(xmlString);
}

export function parseMusicXmlToDocument(xmlString: string): MusicalDocument {
  const result = MusicXmlParser.parse(xmlString);
  return createMusicalDocument(result.score, {
    metadata: result.metadata,
    conversionReport: result.report,
    source: { format: 'musicxml', text: xmlString },
  });
}
