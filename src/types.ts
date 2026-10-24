/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SolfaNote {
  syllable: string;           // e.g., 'd', 'r', 'm', 'fi', 's'
  scaleDegree: number;        // 0-11 scale degree
  midiPitch: number;          // MIDI note number (e.g., 60 for C4)
  octaveRelativeToVoice: number; // Signed int (relative to the voice's home register)
  durationTicks: number;      // Duration in piano-roll ticks (16 per quarter note)
  isRest: boolean;            // True if this is a rest
  timestamp: number;          // Playback offset in ticks from start of piece
  
  // Raw fields populated by parser for transformer
  rawLetter?: string;         // e.g., 'C', 'g', 'z'
  rawAccidental?: string;     // e.g., '^', '_', '=', or undefined
  octaveNum?: number;         // Absolute octave number (e.g. 4, 5, 3)
  solfaOctave?: number;       // Solfa octave: Math.floor((midiPitch - keyInfo.tonic)/12)
}

export interface Measure {
  notes: SolfaNote[];
  rawText: string;
}

export interface VoiceLine {
  voiceId: string;
  measures: Measure[];
  barTypes: string[];        // Barline symbol that *follows* each measure
}

export interface System {
  systemIndex: number;
  voices: { [voiceId: string]: VoiceLine };
}

export interface VoiceDeclaration {
  id: string;
  name: string;
  clef: string;
  order: number;
}

export interface ParseWarning {
  voiceId?: string;
  systemIndex?: number;
  measureIndex?: number;
  rawText: string;
  reason: string;
}

export interface SelectedNoteLocation {
  systemIndex: number;
  voiceId: string;
  measureIndex: number;
  noteIndex: number;
}

export interface ParsedScore {
  title: string;
  composer: string;
  key: string;               // Raw key, e.g., "G", "Eb"
  meter: string;             // Raw meter, e.g., "4/4", "3/4"
  tempoBpm?: number;         // Quarter notes per minute when specified by the source
  defaultLength: string;     // Raw L:, e.g., "1/4", "1/8"
  index: string;             // X: index
  voices: VoiceDeclaration[];
  voicePairingGroups: string[][]; // Groups of voices bracketed together, e.g. [['S', 'A'], ['T', 'B']]
  systems: System[];
  
  // Extra metadata
  hymnMeter?: string;
  tuneName?: string;
  hymnName?: string;
  verses?: number;
  hasDescant?: boolean;
  lyrics?: string[];
}
