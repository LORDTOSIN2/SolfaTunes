export const TICKS_PER_QUARTER_NOTE = 16;
export const TICKS_PER_WHOLE_NOTE = TICKS_PER_QUARTER_NOTE * 4;

export function getTicksPerMeasure(meterStr: string | undefined): number {
  if (!meterStr) return TICKS_PER_WHOLE_NOTE;
  const meter = meterStr.trim();
  if (meter === 'C' || meter === 'C|') return TICKS_PER_WHOLE_NOTE;

  const parts = meter.split('/');
  if (parts.length !== 2) return TICKS_PER_WHOLE_NOTE;

  const numerator = Number.parseInt(parts[0], 10);
  const denominator = Number.parseInt(parts[1], 10);
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || numerator <= 0 || denominator <= 0) {
    return TICKS_PER_WHOLE_NOTE;
  }

  return Math.round((numerator * TICKS_PER_WHOLE_NOTE) / denominator);
}
