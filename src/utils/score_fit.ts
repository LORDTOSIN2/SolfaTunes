/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore } from '../types';

/**
 * Calculates the optimal notation font size (in pixels) for a given score and available width.
 * This guarantees that when a score is loaded, all notes and measures across the widest system
 * fit comfortably on the screen (especially on mobile devices) without needing horizontal scrolling.
 * Horizontal scrolling will only commence when the user explicitly increases the font size.
 */
export function calculateFitFontSize(
  score: ParsedScore | null,
  containerWidth: number
): number {
  if (!score || !score.systems || score.systems.length === 0) {
    return 16;
  }

  // Fallback if containerWidth is not yet measured or is 0
  const viewportWidth =
    containerWidth > 0
      ? containerWidth
      : typeof window !== 'undefined' && window.innerWidth
      ? window.innerWidth
      : 390;

  // Outer padding allowance (outer container padding ~16px + paper sheet padding ~24px = 40px)
  const availableContentWidth = Math.max(260, viewportWidth - 44);

  // Time meter beats (e.g. "4/4" -> 4 beats, "3/4" -> 3 beats, "2/4" -> 2 beats)
  const meterParts = (score.meter || '4/4').split('/');
  const defaultBeatsPerMeasure = parseInt(meterParts[0], 10) || 4;

  let maxSystemWidthAt16 = 0;
  let maxSystemSlope = 0;
  let maxSystemBase = 0;

  for (const system of score.systems) {
    // Determine the number of measures in this system across all voices
    let systemMeasuresCount = 0;
    for (const voiceId of Object.keys(system.voices)) {
      const line = system.voices[voiceId];
      if (line && line.measures.length > systemMeasuresCount) {
        systemMeasuresCount = line.measures.length;
      }
    }

    if (systemMeasuresCount === 0) continue;

    // Sticky voice label column width base (~44px on mobile)
    const labelColumnBase = 44;
    let systemBase = labelColumnBase;
    let systemSlope = 0;

    for (let mIdx = 0; mIdx < systemMeasuresCount; mIdx++) {
      let maxNotesInMeasure = 0;

      for (const voiceId of Object.keys(system.voices)) {
        const line = system.voices[voiceId];
        const measure = line?.measures[mIdx];
        if (measure) {
          const notesCount = measure.notes.length;
          if (notesCount > maxNotesInMeasure) {
            maxNotesInMeasure = notesCount;
          }
        }
      }

      const beats = Math.max(defaultBeatsPerMeasure, 1);
      const items = Math.max(maxNotesInMeasure, beats);
      const colons = Math.max(0, beats - 1);

      // Measure layout:
      // - Measure wrapper padding + barline: ~10px fixed
      // - Colons: colons * (0.35 * F + 4px fixed)
      // - Pulse items (notes, sustains, rests): items * (0.85 * F + 4px fixed)
      const measureFixed = 10 + colons * 4 + items * 4;
      const measureSlope = colons * 0.35 + items * 0.85;

      systemBase += measureFixed;
      systemSlope += measureSlope;
    }

    const systemWidthAt16 = systemBase + systemSlope * 16;
    if (systemWidthAt16 > maxSystemWidthAt16) {
      maxSystemWidthAt16 = systemWidthAt16;
      maxSystemBase = systemBase;
      maxSystemSlope = systemSlope;
    }
  }

  if (maxSystemSlope <= 0) {
    return 16;
  }

  // Solve: availableContentWidth = maxSystemBase + maxSystemSlope * F
  // => F = (availableContentWidth - maxSystemBase) / maxSystemSlope
  const calculatedF = (availableContentWidth - maxSystemBase) / maxSystemSlope;

  // Mobile constraint: if screen is narrow (< 640px), keep default fit between 11px and 18px
  const isMobile = viewportWidth < 640;
  const maxDefault = isMobile ? 18 : 22;
  const minDefault = 11;

  const fitted = Math.max(minDefault, Math.min(maxDefault, Math.floor(calculatedF)));
  return fitted;
}
