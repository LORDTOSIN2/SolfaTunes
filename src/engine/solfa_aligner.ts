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
  return text
    // Lower octaves
    .replace(/\b([drsmflt](?:[eia])?)(?:_3|3|,,,|₃)\b/gi, '$1₃')
    .replace(/\b([drsmflt](?:[eia])?)(?:_2|2|,,|₂)\b/gi, '$1₂')
    .replace(/\b([drsmflt](?:[eia])?)(?:_1|1|,|₁)\b/gi, '$1₁')
    // Upper octaves
    .replace(/([drsmflt](?:[eia])?)(?:\^3|'{3}|\*{3}|³)/gi, '$1³')
    .replace(/([drsmflt](?:[eia])?)(?:\^2|'{2}|\*{2}|²)/gi, '$1²')
    .replace(/([drsmflt](?:[eia])?)(?:\^1|'|\*|¹)/gi, '$1¹');
}

/**
 * Aligns measure bars ('|', '||', '|]') and beat pulse dividers (':') across voices in each system block.
 * Also normalizes forgiving octave notation.
 */
export function alignSolfaGrid(solfaText: string): string {
  // 1. Normalize octave representations
  const normalized = normalizeSolfaOctaves(solfaText);
  const lines = normalized.split('\n');
  const resultLines: string[] = [];

  let currentVoiceBlock: string[] = [];

  const barRegex = /(\|\]|\|\||::|:\||\|:|\|)/;

  const flushVoiceBlock = () => {
    if (currentVoiceBlock.length === 0) return;

    if (currentVoiceBlock.length === 1) {
      resultLines.push(currentVoiceBlock[0]);
      currentVoiceBlock = [];
      return;
    }

    const parsedVoices = currentVoiceBlock.map(line => {
      const match = line.match(/^([A-Za-z0-9_]+:)\s*(.*)$/);
      const prefix = match ? match[1] : '';
      const content = match ? match[2] : line;
      const parts = content.split(barRegex).map(p => p.trim());
      return { prefix, parts };
    });

    const maxParts = Math.max(...parsedVoices.map(v => v.parts.length));
    const alignedPartsPerVoice: string[][] = parsedVoices.map(() => []);

    for (let partIdx = 0; partIdx < maxParts; partIdx++) {
      const isBarline = parsedVoices.some(v => v.parts[partIdx] && barRegex.test(v.parts[partIdx]));

      if (isBarline) {
        parsedVoices.forEach((v, vIdx) => {
          const bar = v.parts[partIdx] || '|';
          alignedPartsPerVoice[vIdx].push(bar);
        });
      } else {
        // Measure note text: split each voice's measure into beat cells by ':'
        const cellLists = parsedVoices.map(v => {
          const text = v.parts[partIdx] || '';
          if (!text) return [];
          return text.split(':').map(c => c.trim());
        });

        const maxCells = Math.max(...cellLists.map(c => c.length));
        const cellWidths: number[] = Array.from({ length: maxCells }, () => 0);

        for (let c = 0; c < maxCells; c++) {
          cellWidths[c] = Math.max(...cellLists.map(list => (list[c] || '').length));
        }

        parsedVoices.forEach((v, vIdx) => {
          const list = cellLists[vIdx];
          if (list.length === 0) {
            alignedPartsPerVoice[vIdx].push('');
            return;
          }
          const formattedCells = list.map((cell, cIdx) => cell.padEnd(cellWidths[cIdx], ' '));
          alignedPartsPerVoice[vIdx].push(formattedCells.join(' : '));
        });
      }
    }

    const formattedBlock = parsedVoices.map((v, vIdx) => {
      const parts = alignedPartsPerVoice[vIdx];
      let line = v.prefix.padEnd(3, ' ') + ' ';
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (barRegex.test(p)) {
          line += (i === 0 ? '' : ' ') + p + ' ';
        } else {
          line += p;
        }
      }
      return line.trimEnd();
    });

    resultLines.push(...formattedBlock);
    currentVoiceBlock = [];
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    const isVoiceLine = /^(?:[A-Z]:|V:[A-Za-z0-9_]+:)/i.test(trimmed);
    const isSystemHeader = trimmed.startsWith('% --- System');
    const isHeader = /^KEY\s+/i.test(trimmed) || /^[A-Z]:\s*(?!\|)/i.test(trimmed);
    const isComment = trimmed.startsWith('%');
    const isLyrics = /^W:/i.test(trimmed);
    const isEmpty = trimmed === '';

    if (isVoiceLine) {
      currentVoiceBlock.push(line);
    } else {
      flushVoiceBlock();
      resultLines.push(line);
    }
  });

  flushVoiceBlock();
  return resultLines.join('\n');
}
