/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore, SolfaNote } from '../types';

/**
 * Maps MIDI note numbers to standard frequencies.
 */
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * A single scheduled synth voice instance.
 */
class SynthVoice {
  private oscillators: OscillatorNode[] = [];
  private gainNode: GainNode;
  private ctx: AudioContext;

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    midiPitch: number,
    startTime: number,
    duration: number
  ) {
    this.ctx = ctx;
    const freq = midiToFreq(midiPitch);

    const gainNode = ctx.createGain();
    gainNode.connect(destination);
    this.gainNode = gainNode;

    const attack = 0.04;
    const release = 0.15;
    const endTime = startTime + duration;

    // Apply envelope
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.20, startTime + attack);
    gainNode.gain.setValueAtTime(0.20, Math.max(startTime + attack, endTime - 0.02));
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime + release);

    // Warm Organ / Vocal Blend Synthesis:
    // 1. Triangle wave: clean, flute-like body
    const oscTriangle = ctx.createOscillator();
    oscTriangle.type = 'triangle';
    oscTriangle.frequency.setValueAtTime(freq, startTime);
    oscTriangle.connect(gainNode);
    this.oscillators.push(oscTriangle);

    // 2. Sub-Sine wave (1 octave down): rich foundation, especially for lower registers
    const oscSineSub = ctx.createOscillator();
    oscSineSub.type = 'sine';
    oscSineSub.frequency.setValueAtTime(freq / 2, startTime);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.12, startTime);
    oscSineSub.connect(subGain);
    subGain.connect(gainNode);
    this.oscillators.push(oscSineSub);

    // 3. Lowpass Filtered Sawtooth wave: provides slight "reedy" or vocal formant definition
    const oscSaw = ctx.createOscillator();
    oscSaw.type = 'sawtooth';
    oscSaw.frequency.setValueAtTime(freq, startTime);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.5, startTime);
    
    const sawGain = ctx.createGain();
    sawGain.gain.setValueAtTime(0.04, startTime);

    oscSaw.connect(filter);
    filter.connect(sawGain);
    sawGain.connect(gainNode);
    this.oscillators.push(oscSaw);

    // Start oscillators
    this.oscillators.forEach(osc => {
      osc.start(startTime);
      osc.stop(endTime + release + 0.1);
    });
  }

  /**
   * Stops the oscillators immediately with a quick fade-out.
   */
  public stop() {
    try {
      this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);
      setTimeout(() => {
        this.oscillators.forEach(osc => {
          try { osc.stop(); } catch (e) {}
        });
      }, 50);
    } catch (e) {}
  }
}

/**
 * Polyphonic MIDI Player engine.
 */
export class MidiPlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private score: ParsedScore | null = null;
  private bpm = 120;
  private transposeOffset = 0; // Transposition in semitones
  private activeVoices: { [voiceId: string]: boolean } = {};
  
  // State
  private isPlaying = false;
  private pausedEighth = 0;
  private startCtxTime = 0;
  private totalEighths = 0;

  // Active playing voices
  private scheduledVoices: SynthVoice[] = [];
  
  // Interval for playhead polling
  private pollingTimer: number | null = null;
  private onProgressCallback: ((currentEighth: number) => void) | null = null;

  constructor() {}

  /**
   * Initializes AudioContext on-demand (browser autoplay policy safe).
   */
  private initAudio() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Loads a score and computes its total eighth-note length.
   */
  public loadScore(score: ParsedScore, bpm: number, activeVoices: { [voiceId: string]: boolean }) {
    this.stop();
    this.score = score;
    this.bpm = bpm;
    this.activeVoices = activeVoices;
    this.pausedEighth = 0;

    // Calculate total duration
    let maxEighth = 0;
    score.voices.forEach(v => {
      score.systems.forEach(sys => {
        const line = sys.voices[v.id];
        if (line) {
          line.measures.forEach(measure => {
            measure.notes.forEach(note => {
              const end = note.timestamp + note.durationInEighths;
              if (end > maxEighth) {
                maxEighth = end;
              }
            });
          });
        }
      });
    });
    this.totalEighths = maxEighth;
  }

  /**
   * Updates current active voices on-the-fly or while stopped.
   */
  public updateActiveVoices(activeVoices: { [voiceId: string]: boolean }) {
    this.activeVoices = activeVoices;
    if (this.isPlaying && this.score) {
      // Re-schedule remaining notes to apply active voice toggles instantly!
      const currentPos = this.getCurrentEighth();
      this.pause();
      this.pausedEighth = currentPos;
      this.play(this.onProgressCallback!);
    }
  }

  /**
   * Set BPM on the fly.
   */
  public setBpm(newBpm: number) {
    this.bpm = newBpm;
    if (this.isPlaying && this.score) {
      const currentPos = this.getCurrentEighth();
      this.pause();
      this.pausedEighth = currentPos;
      this.play(this.onProgressCallback!);
    }
  }

  /**
   * Set dynamic transposition offset in semitones.
   */
  public setTransposeOffset(offset: number) {
    this.transposeOffset = offset;
    if (this.isPlaying && this.score) {
      const currentPos = this.getCurrentEighth();
      this.pause();
      this.pausedEighth = currentPos;
      this.play(this.onProgressCallback!);
    }
  }

  /**
   * Play or Resume.
   */
  public play(onProgress: (currentEighth: number) => void) {
    if (this.isPlaying) return;
    if (!this.score) return;

    this.initAudio();
    this.onProgressCallback = onProgress;
    const ctx = this.ctx!;

    const secondsPerEighth = 30 / this.bpm;
    this.startCtxTime = ctx.currentTime;
    this.isPlaying = true;

    // Schedule all notes from pausedEighth onwards
    this.score.voices.forEach(voice => {
      // Skip if voice is muted
      if (this.activeVoices[voice.id] === false) return;

      this.score!.systems.forEach(system => {
        const line = system.voices[voice.id];
        if (!line) return;

        line.measures.forEach(measure => {
          measure.notes.forEach(note => {
            if (note.isRest) return;
            if (note.timestamp < this.pausedEighth) return;

            // Compute relative scheduling times
            const delayEighths = note.timestamp - this.pausedEighth;
            const startSec = delayEighths * secondsPerEighth;
            const durSec = note.durationInEighths * secondsPerEighth;

            const startTime = this.startCtxTime + startSec;

            // Instantiate custom synth voice
            const voiceNode = new SynthVoice(
              ctx,
              this.masterGain!,
              note.midiPitch + this.transposeOffset, // Appending transposition offset
              startTime,
              durSec
            );
            this.scheduledVoices.push(voiceNode);
          });
        });
      });
    });

    // Start timer polling for progress updates
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = window.setInterval(() => {
      const current = this.getCurrentEighth();
      
      if (current >= this.totalEighths) {
        this.stop();
        onProgress(0);
      } else {
        onProgress(current);
      }
    }, 50);
  }

  /**
   * Pause playback.
   */
  public pause() {
    if (!this.isPlaying) return;

    // Capture paused spot
    this.pausedEighth = this.getCurrentEighth();
    this.isPlaying = false;

    // Clear polling timer
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    // Stop all scheduled synth nodes
    this.scheduledVoices.forEach(v => v.stop());
    this.scheduledVoices = [];
  }

  /**
   * Stop playback completely and reset.
   */
  public stop() {
    this.isPlaying = false;
    this.pausedEighth = 0;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.scheduledVoices.forEach(v => v.stop());
    this.scheduledVoices = [];
  }

  /**
   * Computes the current playhead position in eighth-note units.
   */
  public getCurrentEighth(): number {
    if (!this.isPlaying) return this.pausedEighth;
    if (!this.ctx) return 0;

    const elapsedSecs = this.ctx.currentTime - this.startCtxTime;
    const secondsPerEighth = 30 / this.bpm;
    const elapsedEighths = elapsedSecs / secondsPerEighth;
    
    return Math.min(this.pausedEighth + elapsedEighths, this.totalEighths);
  }

  /**
   * Dispose resources.
   */
  public dispose() {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
