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
  
  // Per-voice sub-mixing gain nodes
  private voiceGains: { [voiceId: string]: GainNode } = {};
  
  // State
  private isPlaying = false;
  private pausedTick = 0;
  private startCtxTime = 0;
  private totalTicks = 0;
  private nextScheduleWindowStartTick = 0;
  private masterVolume = 0.8;
  private isLooping = false;

  // Active playing voices
  private scheduledVoices: SynthVoice[] = [];
  
  // Interval for playhead polling
  private pollingTimer: number | null = null;
  private onProgressCallback: ((currentTick: number) => void) | null = null;

  constructor() {}

  /**
   * Initializes AudioContext on-demand (browser autoplay policy safe).
   */
  private initAudio() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Dynamically gets or creates the GainNode for a specific voice.
   */
  private getVoiceGain(voiceId: string): GainNode {
    this.initAudio();
    const ctx = this.ctx!;
    
    if (!this.voiceGains[voiceId]) {
      const gainNode = ctx.createGain();
      // activeVoices: true means MUTED, false/undefined means ACTIVE
      const isMuted = !!this.activeVoices[voiceId];
      gainNode.gain.setValueAtTime(isMuted ? 0.0 : 1.0, ctx.currentTime);
      gainNode.connect(this.masterGain!);
      this.voiceGains[voiceId] = gainNode;
    }
    
    return this.voiceGains[voiceId];
  }

  /**
   * Loads a score and computes its total tick length (in sixteenths).
   */
  public loadScore(score: ParsedScore, bpm: number, activeVoices: { [voiceId: string]: boolean }) {
    this.stop();
    this.score = score;
    this.bpm = bpm;
    this.activeVoices = activeVoices;
    this.pausedTick = 0;

    // Disconnect and clear old voice gain nodes
    if (this.ctx) {
      Object.keys(this.voiceGains).forEach(vId => {
        try {
          this.voiceGains[vId].disconnect();
        } catch (e) {}
      });
    }
    this.voiceGains = {};

    // Calculate total duration
    let maxTick = 0;
    score.voices.forEach(v => {
      score.systems.forEach(sys => {
        const line = sys.voices[v.id];
        if (line) {
          line.measures.forEach(measure => {
            measure.notes.forEach(note => {
              const end = note.timestamp + note.durationTicks;
              if (end > maxTick) {
                maxTick = end;
              }
            });
          });
        }
      });
    });
    this.totalTicks = maxTick;
  }

  /**
   * Updates current active voices on-the-fly or while stopped.
   */
  public updateActiveVoices(activeVoices: { [voiceId: string]: boolean }) {
    this.activeVoices = activeVoices;
    
    // Smoothly adjust the sub-mixing gain of each voice in real time!
    if (this.ctx) {
      const now = this.ctx.currentTime;
      // Update all voices present in current score (or in activeVoices)
      const voicesToUpdate = this.score ? this.score.voices.map(v => v.id) : Object.keys(activeVoices);
      
      voicesToUpdate.forEach(voiceId => {
        const isMuted = !!activeVoices[voiceId];
        const gainNode = this.getVoiceGain(voiceId);
        
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(isMuted ? 0.0 : 1.0, now + 0.015); // Smooth 15ms click-free transition
      });
    }
  }

  /**
   * Set BPM on the fly.
   */
  public setBpm(newBpm: number) {
    this.bpm = newBpm;
    if (this.isPlaying && this.score) {
      const currentPos = this.getCurrentTick();
      this.pause();
      this.pausedTick = currentPos;
      this.play(this.onProgressCallback!);
    }
  }

  /**
   * Set dynamic transposition offset in semitones.
   */
  public setTransposeOffset(offset: number) {
    this.transposeOffset = offset;
    if (this.isPlaying && this.score) {
      const currentPos = this.getCurrentTick();
      this.pause();
      this.pausedTick = currentPos;
      this.play(this.onProgressCallback!);
    }
  }

  /**
   * Play or Resume.
   */
  public play(onProgress: (currentTick: number) => void) {
    if (this.isPlaying) return;
    if (!this.score) return;

    this.initAudio();
    this.onProgressCallback = onProgress;
    const ctx = this.ctx!;

    const secondsPerTick = 15 / this.bpm; // 1 sixteenth note = 15 / bpm seconds
    this.startCtxTime = ctx.currentTime;
    this.isPlaying = true;

    // Track the scheduling window boundary dynamically
    this.nextScheduleWindowStartTick = this.pausedTick;

    const scheduleNextNotes = () => {
      const current = this.getCurrentTick();
      const lookAheadEnd = current + 8.0; // 8 sixteenth notes in advance (about 1 second at 120bpm)

      if (this.nextScheduleWindowStartTick < lookAheadEnd) {
        const startWindow = this.nextScheduleWindowStartTick;
        this.score!.voices.forEach(voice => {
          // Note: We schedule all voices, and control their volume via per-voice sub-mix gain nodes.
          // This allows users to mute/unmute voices instantly and seamlessly without restarting playback or cutting off active notes!

          this.score!.systems.forEach(system => {
            const line = system.voices[voice.id];
            if (!line) return;

            line.measures.forEach(measure => {
              measure.notes.forEach(note => {
                if (note.isRest) return;
                
                // Only schedule notes that start in the current lookahead window [startWindow, lookAheadEnd)
                if (note.timestamp >= startWindow && note.timestamp < lookAheadEnd) {
                  // Compute relative scheduling times
                  const delayTicks = note.timestamp - this.pausedTick;
                  const startSec = delayTicks * secondsPerTick;
                  const durSec = note.durationTicks * secondsPerTick;

                  const startTime = this.startCtxTime + startSec;

                  // Instantiate custom synth voice and connect to its dedicated voice sub-mix gain node
                  const voiceNode = new SynthVoice(
                    ctx,
                    this.getVoiceGain(voice.id),
                    note.midiPitch + this.transposeOffset, // Appending transposition offset
                    startTime,
                    durSec
                  );
                  this.scheduledVoices.push(voiceNode);
                }
              });
            });
          });
        });

        this.nextScheduleWindowStartTick = lookAheadEnd;
      }
    };

    // Run first schedule pass immediately!
    scheduleNextNotes();

    // Start timer polling for progress updates and dynamic scheduling
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = window.setInterval(() => {
      const current = this.getCurrentTick();
      
      if (current >= this.totalTicks) {
        if (this.isLooping && this.totalTicks > 0) {
          // Smooth loop back to 0
          this.pause();
          this.pausedTick = 0;
          this.play(this.onProgressCallback!);
        } else {
          this.stop();
          onProgress(0);
        }
      } else {
        scheduleNextNotes();
        onProgress(current);
      }
    }, 25); // Faster 25ms poll for tightly scheduled lookahead checks
  }

  /**
   * Set Master Volume (0.0 to 1.0).
   */
  public setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(this.masterVolume, now + 0.02);
    }
  }

  /**
   * Get Master Volume.
   */
  public getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Set Looping mode.
   */
  public setLooping(loop: boolean) {
    this.isLooping = loop;
  }

  /**
   * Get Looping mode.
   */
  public getLooping(): boolean {
    return this.isLooping;
  }

  /**
   * Seeks to a specific tick position.
   */
  public seek(targetTick: number) {
    const boundedTick = Math.max(0, Math.min(targetTick, this.totalTicks));
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
      this.pausedTick = boundedTick;
      this.play(this.onProgressCallback!);
    } else {
      this.pausedTick = boundedTick;
    }
  }

  /**
   * Gets total score duration in ticks.
   */
  public getTotalTicks(): number {
    return this.totalTicks;
  }

  /**
   * Returns whether the Web Audio context is initialized and active.
   */
  public getAudioStatus(): 'ready' | 'active' | 'suspended' {
    if (!this.ctx) return 'ready';
    if (this.isPlaying) return 'active';
    return this.ctx.state === 'running' ? 'ready' : 'suspended';
  }

  /**
   * Pause playback.
   */
  public pause() {
    if (!this.isPlaying) return;

    // Capture paused spot
    this.pausedTick = this.getCurrentTick();
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
    this.pausedTick = 0;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.scheduledVoices.forEach(v => v.stop());
    this.scheduledVoices = [];
  }

  /**
   * Computes the current playhead position in sixteenth-note units.
   */
  public getCurrentTick(): number {
    if (!this.isPlaying) return this.pausedTick;
    if (!this.ctx) return 0;

    const elapsedSecs = this.ctx.currentTime - this.startCtxTime;
    const secondsPerTick = 15 / this.bpm;
    const elapsedTicks = elapsedSecs / secondsPerTick;
    
    return Math.min(this.pausedTick + elapsedTicks, this.totalTicks);
  }

  /**
   * Backwards-compatible alias for getCurrentTick.
   */
  public getCurrentEighth(): number {
    return this.getCurrentTick();
  }

  /**
   * Dispose resources.
   */
  public dispose() {
    this.stop();
    if (this.ctx) {
      Object.keys(this.voiceGains).forEach(vId => {
        try {
          this.voiceGains[vId].disconnect();
        } catch (e) {}
      });
      this.voiceGains = {};
      this.ctx.close();
      this.ctx = null;
    }
  }
}
