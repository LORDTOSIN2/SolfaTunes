/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { calculateFitFontSize } from './score_fit';
import { AbcParser } from '../engine/abc_parser';
import { SolfaTransformer } from '../engine/solfa_transformer';

describe('calculateFitFontSize', () => {
  const sampleAbc = `
X:1
T:Test Hymn
M:4/4
L:1/4
K:C
V:S name="Soprano"
c d e f | g a b c' | c' b a g | f e d c |]
V:A name="Alto"
E F G A | B c d e | e d c B | A G F E |]
`;

  it('calculates a mobile-friendly font size that fits 4 measures on a 390px mobile screen', () => {
    const parser = new AbcParser();
    const { score } = parser.parse(sampleAbc);
    const resolved = new SolfaTransformer().transform(score);

    // Mobile width (e.g. 390px iPhone)
    const mobileFontSize = calculateFitFontSize(resolved, 390);

    expect(mobileFontSize).toBeGreaterThanOrEqual(11);
    expect(mobileFontSize).toBeLessThanOrEqual(18);
  });

  it('allows larger font size on desktop screens (1000px+)', () => {
    const parser = new AbcParser();
    const { score } = parser.parse(sampleAbc);
    const resolved = new SolfaTransformer().transform(score);

    const desktopFontSize = calculateFitFontSize(resolved, 1024);
    const mobileFontSize = calculateFitFontSize(resolved, 375);

    expect(desktopFontSize).toBeGreaterThan(mobileFontSize);
    expect(desktopFontSize).toBeGreaterThanOrEqual(18);
  });

  it('returns default 16 when score is null or empty', () => {
    expect(calculateFitFontSize(null, 400)).toBe(16);
  });
});
