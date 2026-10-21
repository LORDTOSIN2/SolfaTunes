/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes forgiving user input for Tonic Sol-fa syllables into standard Curwen unicode subscripts/superscripts:
 * - Octave 1 below: s1, s_1, s, -> s₁
 * - Octave 2 below: s2, s_2, s,, -> s₂
 * - Octave 3 below: s3, s_3, s,,, -> s₃
 * - Octave 1 above: d^1, d', d* -> d¹
 * - Octave 2 above: d^2, d'', d** -> d²
 * - Octave 3 above: d^3, d''', d*** -> d³
 */
export function normalizeSolfaOctaves(text: string): string {
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    // Do not touch comments, lyrics, or header lines
    if (trimmed.startsWith('%') || /^W:/i.test(trimmed) || /^KEY\s+/i.test(trimmed) || /^M:/i.test(trimmed)) {
      return line;
    }
    // For voice lines, preserve the prefix (e.g. "S:") and normalize the music content
    const match = line.match(/^([A-Za-z0-9_]+:\s*)(.*)$/);
    if (match) {
      const prefix = match[1];
      const rest = match[2];
      const normRest = rest
        // Lower octaves: e.g. s1, s_1, s, -> s₁; d2, d_2, d,, -> d₂
        .replace(/\b([drsmflt](?:[eia])?)(?:_3|3|,,,|₃)\b/gi, '$1₃')
        .replace(/\b([drsmflt](?:[eia])?)(?:_2|2|,,|₂)\b/gi, '$1₂')
        .replace(/\b([drsmflt](?:[eia])?)(?:_1|1|,|₁)\b/gi, '$1₁')
        // Upper octaves: e.g. d^1, d', d* -> d¹; d^2, d'', d** -> d²
        .replace(/([drsmflt](?:[eia])?)(?:\^3|'{3}|\*{3}|³)/gi, '$1³')
        .replace(/([drsmflt](?:[eia])?)(?:\^2|'{2}|\*{2}|²)/gi, '$1²')
        .replace(/([drsmflt](?:[eia])?)(?:\^1|'|\*|¹)/gi, '$1¹');
      return prefix + normRest;
    }
    return line;
  }).join('\n');
}

/**
 * Aligns measure bars ('|', '||', '|]') and beat pulse dividers (':') across voices in each system block.
 * Also normalizes forgiving octave notation.
 */
export function alignSolfaGrid(solfaText: string): string {
  // 1. Normalize forgiving octave representations
  const normalized = normalizeSolfaOctaves(solfaText);
  const lines = normalized.split('\n');
  const resultLines: string[] = [];

  let currentBlock: string[] = [];
  const barRegex = /(\|\]|\|\||::|:\||\|:|\|)/;

  const flushBlock = () => {
    if (currentBlock.length === 0) return;

    if (currentBlock.length === 1) {
      resultLines.push(currentBlock[0]);
      currentBlock = [];
      return;
    }

    const parsedVoices = currentBlock.map(line => {
      const match = line.match(/^([A-Za-z0-9_]+:)\s*(.*)$/);
      const prefix = match ? match[1] : '';
      const content = match ? match[2] : line;
      const rawParts = content.split(barRegex);
      return { prefix, rawParts };
    });

    const maxPrefixLen = Math.max(...parsedVoices.map(v => v.prefix.length));
    const maxPartsCount = Math.max(...parsedVoices.map(v => v.rawParts.length));

    // Step 1: For each measure token (even index), split by ':' and align internal beat cells
    const formattedPartsPerVoice: string[][] = parsedVoices.map(() => []);

    for (let partIdx = 0; partIdx < maxPartsCount; partIdx++) {
      if (partIdx % 2 === 1) {
        // Barline token (odd index)
        parsedVoices.forEach((v, vIdx) => {
          const bar = partIdx < v.rawParts.length ? v.rawParts[partIdx].trim() : '';
          formattedPartsPerVoice[vIdx].push(bar);
        });
      } else {
        // Measure token (even index)
        const measureTexts = parsedVoices.map(v => {
          if (partIdx < v.rawParts.length) return v.rawParts[partIdx].trim();
          return '';
        });

        const voiceCells = measureTexts.map(text => {
          if (!text) return [];
          return text.split(':').map(c => c.trim());
        });

        const maxCells = Math.max(...voiceCells.map(c => c.length));

        if (maxCells > 1) {
          const cellWidths = Array.from({ length: maxCells }, () => 0);
          for (let c = 0; c < maxCells; c++) {
            cellWidths[c] = Math.max(...voiceCells.map(cells => (cells[c] || '').length));
          }

          parsedVoices.forEach((_, vIdx) => {
            const cells = voiceCells[vIdx];
            if (cells.length === 0) {
              formattedPartsPerVoice[vIdx].push('');
            } else {
              const formatted = cells.map((cell, cIdx) => cell.padEnd(cellWidths[cIdx], ' ')).join(' : ');
              formattedPartsPerVoice[vIdx].push(formatted);
            }
          });
        } else {
          parsedVoices.forEach((_, vIdx) => {
            formattedPartsPerVoice[vIdx].push(measureTexts[vIdx]);
          });
        }
      }
    }

    // Step 2: Calculate max width for every part/column across all voices
    const maxColumnWidths = Array.from({ length: maxPartsCount }, () => 0);
    for (let partIdx = 0; partIdx < maxPartsCount; partIdx++) {
      let maxLen = 0;
      formattedPartsPerVoice.forEach(parts => {
        if (partIdx < parts.length) {
          maxLen = Math.max(maxLen, parts[partIdx].length);
        }
      });
      maxColumnWidths[partIdx] = maxLen;
    }

    // Step 3: Reconstruct each line with exact column padding
    const formattedLines = parsedVoices.map((v, vIdx) => {
      const parts = formattedPartsPerVoice[vIdx];
      let line = v.prefix.padEnd(maxPrefixLen, ' ');

      for (let partIdx = 0; partIdx < parts.length; partIdx++) {
        const part = parts[partIdx];
        const maxLen = maxColumnWidths[partIdx];

        if (partIdx % 2 === 1) {
          // Barline
          if (part.length > 0) {
            line += part.padEnd(maxLen, ' ');
          }
        } else {
          // Measure content
          if (partIdx === 0) {
            if (part.length > 0) {
              line += ' ' + part.padEnd(maxLen, ' ') + ' ';
            } else {
              line += ' ';
            }
          } else if (partIdx === parts.length - 1 && part === '') {
            // Trailing empty
          } else {
            line += ' ' + part.padEnd(maxLen, ' ') + ' ';
          }
        }
      }
      return line.trimEnd();
    });

    resultLines.push(...formattedLines);
    currentBlock = [];
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    // A voice line starts with S:, A:, T:, B:, D:, or V:<id>:
    const isVoiceLine = /^(?:[SABTD]|V:[A-Za-z0-9_]+):/i.test(trimmed);

    if (isVoiceLine) {
      currentBlock.push(line);
    } else {
      flushBlock();
      resultLines.push(line);
    }
  });

  flushBlock();
  return resultLines.join('\n');
}
