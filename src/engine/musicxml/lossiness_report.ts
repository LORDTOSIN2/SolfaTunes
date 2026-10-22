/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lossiness report describing conversion fidelity, warnings, unsupported constructs,
 * and any errors encountered during MusicXML import or export.
 */
export interface LossinessReport {
  /** True if conversion succeeded with zero data loss or unsupported elements */
  isLossless: boolean;
  /** List of user-actionable or informative warnings */
  warnings: string[];
  /** Specific notation or structural constructs not supported in SolfaTunes */
  unsupportedConstructs: string[];
  /** Elements stripped or simplified during conversion */
  strippedElements: string[];
  /** Critical errors that prevented complete conversion */
  errors: string[];
}

/**
 * Creates an initial clean LossinessReport.
 */
export function createEmptyLossinessReport(): LossinessReport {
  return {
    isLossless: true,
    warnings: [],
    unsupportedConstructs: [],
    strippedElements: [],
    errors: [],
  };
}

/**
 * Formats a LossinessReport into a clean, human-readable summary string.
 */
export function formatLossinessReport(report: LossinessReport): string {
  const lines: string[] = [];
  lines.push(`Lossiness Status: ${report.isLossless ? 'LOSSLESS' : 'LOSSY / WARNINGS DETECTED'}`);

  if (report.errors.length > 0) {
    lines.push(`Errors (${report.errors.length}):`);
    report.errors.forEach((e) => lines.push(`  - [ERROR] ${e}`));
  }

  if (report.warnings.length > 0) {
    lines.push(`Warnings (${report.warnings.length}):`);
    report.warnings.forEach((w) => lines.push(`  - [WARN] ${w}`));
  }

  if (report.unsupportedConstructs.length > 0) {
    lines.push(`Unsupported Constructs (${report.unsupportedConstructs.length}):`);
    report.unsupportedConstructs.forEach((u) => lines.push(`  - ${u}`));
  }

  if (report.strippedElements.length > 0) {
    lines.push(`Stripped Elements (${report.strippedElements.length}):`);
    report.strippedElements.forEach((s) => lines.push(`  - ${s}`));
  }

  if (
    report.isLossless &&
    report.warnings.length === 0 &&
    report.errors.length === 0 &&
    report.unsupportedConstructs.length === 0 &&
    report.strippedElements.length === 0
  ) {
    lines.push('All musical data, voices, pitches, rhythms, and Sol-fa metadata preserved with 100% fidelity.');
  }

  return lines.join('\n');
}
