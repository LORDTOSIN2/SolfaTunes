import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParsedScore, SolfaNote } from '../types';
import { MidiPlayer } from './midi_player';
import { MusicXmlParser } from '../engine/musicxml/musicxml_parser';

let audioClock = 0;
let nextIntervalId = 1;
const intervals = new Map<number, () => void>();

class FakeAudioParam {
  value = 0;

  setValueAtTime(value: number) {
    this.value = value;
  }

  linearRampToValueAtTime(value: number) {
    this.value = value;
  }

  exponentialRampToValueAtTime(value: number) {
    this.value = value;
  }

  cancelScheduledValues() {}
}

class FakeGainNode {
  gain = new FakeAudioParam();

  connect() {}
  disconnect() {}
}

class FakeOscillatorNode {
  type: OscillatorType = 'sine';
  frequency = new FakeAudioParam();

  connect() {}
  start() {}
  stop() {}
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  destination = {};

  get currentTime() {
    return audioClock;
  }

  createGain() {
    return new FakeGainNode();
  }

  createOscillator() {
    return new FakeOscillatorNode();
  }

  createBiquadFilter() {
    return { type: 'lowpass' as BiquadFilterType, frequency: new FakeAudioParam(), connect() {} };
  }

  resume() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}

function makeScore(): ParsedScore {
  const note: SolfaNote = {
    syllable: 'd',
    scaleDegree: 0,
    midiPitch: 60,
    octaveRelativeToVoice: 0,
    durationTicks: 64,
    isRest: false,
    timestamp: 0,
  };

  return {
    title: 'Playback clock test',
    composer: 'Test',
    key: 'C',
    meter: '4/4',
    defaultLength: '1/4',
    index: '1',
    voices: [{ id: '1', name: 'Soprano', clef: 'treble', order: 0 }],
    voicePairingGroups: [],
    systems: [{
      systemIndex: 0,
      voices: {
        '1': {
          voiceId: '1',
          measures: [{ notes: [note], rawText: 'C' }],
          barTypes: ['|'],
        },
      },
    }],
  };
}

describe('MidiPlayer playback clock', () => {
  let player: MidiPlayer;

  beforeEach(() => {
    audioClock = 100;
    nextIntervalId = 1;
    intervals.clear();
    vi.stubGlobal('window', {
      AudioContext: FakeAudioContext,
      setInterval: (callback: () => void) => {
        const id = nextIntervalId++;
        intervals.set(id, callback);
        return id;
      },
      clearInterval: (id: number) => {
        intervals.delete(id);
      },
    });
    player = new MidiPlayer();
    player.loadScore(makeScore(), 120, {});
  });

  afterEach(() => {
    player.dispose();
    vi.unstubAllGlobals();
  });

  it('derives progress from the audio clock and reports that position on polling', () => {
    const onProgress = vi.fn();
    player.play(onProgress);
    audioClock += 0.5;

    expect(player.getCurrentTick()).toBe(16);
    intervals.values().next().value?.();
    expect(onProgress).toHaveBeenLastCalledWith(16);
  });

  it('plays an imported 72 BPM score at its source tempo', () => {
    const { score } = MusicXmlParser.parse(`<score-partwise version="4.0">
      <part-list><score-part id="P1"><part-name>Soprano</part-name></score-part></part-list>
      <part id="P1"><measure number="1">
        <attributes><divisions>4</divisions><key><fifths>0</fifths></key></attributes>
        <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>72</per-minute></metronome></direction-type><sound tempo="72"/></direction>
        <note><pitch><step>C</step><octave>5</octave></pitch><duration>16</duration><voice>1</voice></note>
      </measure></part>
    </score-partwise>`);
    player.loadScore(score, score.tempoBpm ?? 100, {});

    player.play(vi.fn());
    audioClock += 0.5;

    expect(score.tempoBpm).toBe(72);
    expect(player.getCurrentTick()).toBeCloseTo(9.6);
  });

  it('does not signal playback completion for the initial tick-zero progress update', () => {
    const onProgress = vi.fn();
    const onEnded = vi.fn();
    player.play(onProgress, onEnded);
    const poll = intervals.values().next().value;

    poll?.();

    expect(onProgress).toHaveBeenLastCalledWith(0);
    expect(onEnded).not.toHaveBeenCalled();
    expect(player.getCurrentTick()).toBe(0);

    audioClock += 2;
    poll?.();

    expect(onProgress).toHaveBeenLastCalledWith(0);
    expect(onEnded).toHaveBeenCalledOnce();
    expect(player.getCurrentTick()).toBe(0);
  });

  it('does not signal completion when looping back to the start', () => {
    const onEnded = vi.fn();
    player.setLooping(true);
    player.play(vi.fn(), onEnded);
    const poll = intervals.values().next().value;
    audioClock += 2;
    poll?.();

    expect(onEnded).not.toHaveBeenCalled();
    expect(player.getCurrentTick()).toBe(0);

    audioClock += 0.25;
    expect(player.getCurrentTick()).toBe(8);
  });

  it('preserves the exact current tick when tempo changes during playback', () => {
    player.play(vi.fn());
    audioClock += 0.75;
    expect(player.getCurrentTick()).toBe(24);

    player.setBpm(60);

    expect(player.getCurrentTick()).toBe(24);
    audioClock += 0.5;
    expect(player.getCurrentTick()).toBe(32);
  });

  it('freezes the audio-clock position on pause and resumes without a jump', () => {
    player.play(vi.fn());
    audioClock += 0.5;
    player.pause();

    expect(player.getCurrentTick()).toBe(16);
    audioClock += 2;
    expect(player.getCurrentTick()).toBe(16);

    player.play(vi.fn());
    expect(player.getCurrentTick()).toBe(16);
    audioClock += 0.25;
    expect(player.getCurrentTick()).toBe(24);
  });

  it('seeks to the requested tick while playing and keeps advancing from there', () => {
    player.play(vi.fn());
    audioClock += 0.5;
    player.seek(10);

    expect(player.getCurrentTick()).toBe(10);
    audioClock += 0.25;
    expect(player.getCurrentTick()).toBe(18);
  });
});
