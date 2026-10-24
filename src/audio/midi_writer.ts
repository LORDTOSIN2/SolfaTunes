/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore, SolfaNote } from '../types';
import { TICKS_PER_QUARTER_NOTE } from '../engine/timing';

/**
 * Encodes a numeric value as a variable-length quantity (VLQ) for MIDI.
 */
function toVLQ(value: number): number[] {
  const bytes: number[] = [];
  let flag = 0x00;
  do {
    bytes.push((value & 0x7f) | flag);
    value >>>= 7;
    flag = 0x80;
  } while (value > 0);
  return bytes.reverse();
}

/**
 * Converts a string to an array of character bytes.
 */
function toBytes(str: string): number[] {
  const arr: number[] = [];
  for (let i = 0; i < str.length; i++) {
    arr.push(str.charCodeAt(i));
  }
  return arr;
}

/**
 * Writes a 32-bit integer as a 4-byte array.
 */
function write32(val: number): number[] {
  return [
    (val >>> 24) & 0xff,
    (val >>> 16) & 0xff,
    (val >>> 8) & 0xff,
    val & 0xff
  ];
}

/**
 * Writes a 16-bit integer as a 2-byte array.
 */
function write16(val: number): number[] {
  return [
    (val >>> 8) & 0xff,
    val & 0xff
  ];
}

/**
 * Standard MIDI File generator.
 */
export class MidiWriter {
  /**
   * Generates a complete Standard MIDI File (Type 1) as a Uint8Array.
   */
  public static generateMidiBytes(score: ParsedScore, bpm: number, transposeOffset: number = 0): Uint8Array {
    const midiTicksPerPianoRollTick = 30;
    const ticksPerQuarter = TICKS_PER_QUARTER_NOTE * midiTicksPerPianoRollTick;

    // Track 0: Tempo and Time Signature
    const track0Bytes: number[] = [];
    
    // 1. Time Signature meta event: FF 58 04 nn dd cc bb
    // Meter e.g., "4/4" or "3/4"
    const meterParts = score.meter.split('/');
    const numerator = parseInt(meterParts[0], 10) || 4;
    const denominator = parseInt(meterParts[1], 10) || 4;
    
    // Denominator power of 2 (e.g. 4 -> 2, 8 -> 3)
    let denPower = 2;
    if (denominator === 2) denPower = 1;
    else if (denominator === 4) denPower = 2;
    else if (denominator === 8) denPower = 3;
    else if (denominator === 16) denPower = 4;

    // Delta 0: Time Sig
    track0Bytes.push(...toVLQ(0));
    track0Bytes.push(0xff, 0x58, 0x04, numerator, denPower, 24, 8);

    // 2. Tempo meta event: FF 51 03 tttttt (microseconds per quarter note)
    const microSecsPerQuarter = Math.round(60000000 / bpm);
    track0Bytes.push(...toVLQ(0));
    track0Bytes.push(
      0xff, 0x51, 0x03,
      (microSecsPerQuarter >>> 16) & 0xff,
      (microSecsPerQuarter >>> 8) & 0xff,
      microSecsPerQuarter & 0xff
    );

    // 3. Track name: FF 03 length text
    const titleBytes = toBytes(score.title);
    track0Bytes.push(...toVLQ(0));
    track0Bytes.push(0xff, 0x03, ...toVLQ(titleBytes.length), ...titleBytes);

    // 4. End of Track: FF 2F 00
    track0Bytes.push(...toVLQ(0));
    track0Bytes.push(0xff, 0x2f, 0x00);

    // Generate tracks for each voice
    const tracks: number[][] = [track0Bytes];

    score.voices.forEach((voice, voiceIndex) => {
      const voiceTrackBytes: number[] = [];
      const channel = Math.min(voiceIndex, 15); // limit channel to 0-15

      // Track name
      const vNameBytes = toBytes(voice.name);
      voiceTrackBytes.push(...toVLQ(0));
      voiceTrackBytes.push(0xff, 0x03, ...toVLQ(vNameBytes.length), ...vNameBytes);

      // Program change: Set instrument (Piano, Organ, Choir, etc.)
      // E.g., Acoustic Grand Piano (0) or Drawbar Organ (16) or Choir Aahs (52)
      // Standard choral/hymn context: we can default to Drawbar Organ (16) or Acoustic Grand Piano (0)
      // Let's use Drawbar Organ (16) as a standard church hymnal sound or Choir Aahs (52)
      // A safe play is program 19 (Church Organ) or 52 (Choir Aahs) or 0 (Acoustic Grand Piano)
      // Let's use 19 (Church Organ) as default church hymnal sound for beautiful choral blend!
      const instrumentProgram = 19; 
      voiceTrackBytes.push(...toVLQ(0));
      voiceTrackBytes.push(0xc0 | channel, instrumentProgram);

      // Collect all notes across all systems/measures for this voice
      interface MidiEvent {
        tick: number;
        type: 'on' | 'off';
        pitch: number;
      }

      const events: MidiEvent[] = [];

      score.systems.forEach(system => {
        const voiceLine = system.voices[voice.id];
        if (!voiceLine) return;

        voiceLine.measures.forEach(measure => {
          measure.notes.forEach(note => {
            if (note.isRest) return;

            const startTick = note.timestamp * midiTicksPerPianoRollTick;
            const endTick = (note.timestamp + note.durationTicks) * midiTicksPerPianoRollTick;

            events.push({
              tick: startTick,
              type: 'on',
              pitch: note.midiPitch + transposeOffset
            });
            events.push({
              tick: endTick,
              type: 'off',
              pitch: note.midiPitch + transposeOffset
            });
          });
        });
      });

      // Sort events: primary sort by tick, secondary sort: 'off' before 'on' at the same tick
      events.sort((a, b) => {
        if (a.tick !== b.tick) return a.tick - b.tick;
        return a.type === 'off' ? -1 : 1;
      });

      // Write notes as delta events
      let lastTick = 0;
      events.forEach(event => {
        const delta = event.tick - lastTick;
        voiceTrackBytes.push(...toVLQ(delta));

        if (event.type === 'on') {
          // Note On: 90 channel pitch velocity
          voiceTrackBytes.push(0x90 | channel, event.pitch, 85);
        } else {
          // Note Off: 80 channel pitch velocity
          voiceTrackBytes.push(0x80 | channel, event.pitch, 0);
        }

        lastTick = event.tick;
      });

      // End of Track
      voiceTrackBytes.push(...toVLQ(0));
      voiceTrackBytes.push(0xff, 0x2f, 0x00);

      tracks.push(voiceTrackBytes);
    });

    // Assemble the full file bytes
    const finalBytes: number[] = [];

    // 1. MThd header chunk: 'MThd'
    finalBytes.push(...toBytes('MThd'));
    finalBytes.push(...write32(6)); // chunk length (always 6)
    finalBytes.push(...write16(1)); // file format (1 = multi-track asynchronous)
    finalBytes.push(...write16(tracks.length)); // number of tracks
    finalBytes.push(...write16(ticksPerQuarter)); // subdivision division

    // 2. Track chunks
    tracks.forEach(track => {
      finalBytes.push(...toBytes('MTrk'));
      finalBytes.push(...write32(track.length));
      finalBytes.push(...track);
    });

    return new Uint8Array(finalBytes);
  }

  /**
   * Helper to trigger download of MIDI file in the browser.
   */
  public static downloadMidiFile(score: ParsedScore, bpm: number, transposeOffset: number = 0) {
    const bytes = this.generateMidiBytes(score, bpm, transposeOffset);
    const blob = new Blob([bytes], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    
    // Normalize file name
    const safeTitle = score.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    a.download = `${safeTitle || 'solfa_score'}.mid`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
