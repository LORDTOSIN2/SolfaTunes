import { describe, expect, it } from 'vitest';
import { ParsedScore, SolfaNote } from '../types';
import { findActiveMeasureRange, getScoreMeasureRanges } from './playback_timeline';

function makeMeasure(durationTicks: number) {
  const note: SolfaNote = {
    syllable: 'd',
    scaleDegree: 0,
    midiPitch: 60,
    octaveRelativeToVoice: 0,
    durationTicks,
    isRest: false,
    timestamp: 0,
  };
  return { notes: [note], rawText: 'C' };
}

function makeScore(): ParsedScore {
  return {
    title: 'Timeline test',
    composer: 'Test',
    key: 'C',
    meter: '4/4',
    defaultLength: '1/4',
    index: '1',
    voices: [
      { id: '1', name: 'Soprano', clef: 'treble', order: 0 },
      { id: '2', name: 'Alto', clef: 'treble', order: 1 },
    ],
    voicePairingGroups: [],
    systems: [
      {
        systemIndex: 0,
        voices: {
          '1': {
            voiceId: '1',
            measures: [makeMeasure(4), makeMeasure(8)],
            barTypes: ['|', '|'],
          },
          '2': {
            voiceId: '2',
            measures: [makeMeasure(12), makeMeasure(8)],
            barTypes: ['|', '|'],
          },
        },
      },
      {
        systemIndex: 1,
        voices: {
          '1': {
            voiceId: '1',
            measures: [makeMeasure(8)],
            barTypes: ['|'],
          },
          '2': {
            voiceId: '2',
            measures: [makeMeasure(4), makeMeasure(4)],
            barTypes: ['|', '|'],
          },
        },
      },
    ],
  };
}

describe('score playback measure timeline', () => {
  it('uses the longest voice in each measure and includes measures missing from the first voice', () => {
    expect(getScoreMeasureRanges(makeScore())).toEqual([
      { systemIndex: 0, measureIndex: 0, start: 0, end: 12 },
      { systemIndex: 0, measureIndex: 1, start: 12, end: 20 },
      { systemIndex: 1, measureIndex: 0, start: 20, end: 28 },
      { systemIndex: 1, measureIndex: 1, start: 28, end: 32 },
    ]);
  });

  it('moves to the next measure exactly at a boundary and stays on the final measure at the end', () => {
    const ranges = getScoreMeasureRanges(makeScore());

    expect(findActiveMeasureRange(ranges, 11.99)).toBe(ranges[0]);
    expect(findActiveMeasureRange(ranges, 12)).toBe(ranges[1]);
    expect(findActiveMeasureRange(ranges, 20)).toBe(ranges[2]);
    expect(findActiveMeasureRange(ranges, 32)).toBe(ranges[3]);
  });

  it('reserves a fallback measure duration for empty measures, matching the audio timeline', () => {
    const score = makeScore();
    score.systems[0].voices['2'].measures[0].notes = [];

    expect(getScoreMeasureRanges(score)[0]).toEqual({
      systemIndex: 0,
      measureIndex: 0,
      start: 0,
      end: 4,
    });
  });
});
