import { ParsedScore } from '../types';

export interface ScoreMeasureRange {
  systemIndex: number;
  measureIndex: number;
  start: number;
  end: number;
}

export function getScoreMeasureRanges(score: ParsedScore | null): ScoreMeasureRange[] {
  if (!score) return [];

  const ranges: ScoreMeasureRange[] = [];
  let timelineOffset = 0;

  score.systems.forEach(system => {
    const systemMeasureCount = Math.max(
      0,
      ...score.voices.map(voice => system.voices[voice.id]?.measures.length || 0)
    );

    for (let measureIndex = 0; measureIndex < systemMeasureCount; measureIndex++) {
      let measureDuration = 0;

      score.voices.forEach(voice => {
        const measure = system.voices[voice.id]?.measures[measureIndex];
        if (!measure) return;

        const voiceDuration = measure.notes.reduce(
          (duration, note) => duration + note.durationTicks,
          0
        );
        measureDuration = Math.max(measureDuration, voiceDuration);
      });

      if (measureDuration === 0) measureDuration = 16;

      ranges.push({
        systemIndex: system.systemIndex,
        measureIndex,
        start: timelineOffset,
        end: timelineOffset + measureDuration,
      });
      timelineOffset += measureDuration;
    }
  });

  return ranges;
}

export function findActiveMeasureRange(
  ranges: ScoreMeasureRange[],
  tick: number
): ScoreMeasureRange | undefined {
  const activeRange = ranges.find(range => tick >= range.start && tick < range.end);
  if (activeRange) return activeRange;

  const lastRange = ranges[ranges.length - 1];
  return lastRange && tick >= lastRange.end ? lastRange : undefined;
}
