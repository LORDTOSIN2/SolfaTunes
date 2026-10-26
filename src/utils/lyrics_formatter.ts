/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Heuristic detector to determine if a string of pasted text is likely
 * natural language hymn lyrics, verses, or poetic stanzas rather than
 * ABC music code, Tonic Sol-fa notes, or general system commands.
 */
export function isLikelyLyricsOrVerse(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return false;

  // 1. ABC Header fields or whole file indicators
  const isAbcHeaderOrFile = lines.some((l) =>
    /^[XTKMCL]:/i.test(l) ||
    /^%%(?:staves|score)/i.test(l) ||
    /^KEY\s+[A-Ga-g]/i.test(l)
  );
  if (isAbcHeaderOrFile) return false;

  // 2. Music notation indicators: measure bars, repeat barlines, or voice tags
  const hasMusicBarLines = lines.some((l) =>
    /\|\]|\|\||::|:\||\|:|\|/.test(l)
  );
  const hasVoiceDefs = lines.some((l) =>
    /^\[?V:[A-Za-z0-9_]+\]?/i.test(l) || /^[SATBD]:\s*\|/i.test(l)
  );
  if (hasMusicBarLines || hasVoiceDefs) return false;

  // 3. If all non-empty lines already start with W: or w:, it's already formatted
  const allAlreadyW = lines.every((l) => /^W:\s*/i.test(l));
  if (allAlreadyW) return false;

  // 4. Natural language verse / word analysis
  let wordLikeLineCount = 0;
  for (const line of lines) {
    // Strip optional leading verse numbering like "1.", "Verse 2:", "(3)"
    const cleanLine = line.replace(
      /^(\d+\.?|\(\d+\)|Verse\s*\d+:?|Refrain:?|Chorus:?)\s*/i,
      ''
    );
    const words = cleanLine.split(/\s+/).filter((w) => w.length > 0);

    // Hymn / lyric lines typically consist of multiple alphabetic words
    if (words.length >= 2) {
      const hasAlpha = words.some((w) => /[a-zA-Z]{2,}/.test(w));
      if (hasAlpha) {
        wordLikeLineCount++;
      }
    } else if (words.length === 1 && /^[A-Za-z]{3,}[.,!?;:'"]*$/.test(words[0])) {
      // Single word line like "Amen." or "Alleluia!"
      wordLikeLineCount++;
    }
  }

  // Single line pasted: must have at least 3 words and letters
  if (lines.length === 1) {
    const words = lines[0].split(/\s+/);
    return words.length >= 3 && /[a-zA-Z]{2,}/.test(lines[0]);
  }

  // Multi-line paste: at least half of the lines look like poetry/prose lines
  return wordLikeLineCount >= Math.ceil(lines.length * 0.5);
}

/**
 * Formats pasted text into standard ABC / Tonic Sol-fa "W: " lyrics lines.
 * - Non-empty lines are prefixed with "W: " (preserving existing numbering).
 * - Empty/whitespace lines (stanza separators) are formatted as "W:" (standard in ABC & Solfa).
 * - Lines that already have "W:" or "w:" are normalized cleanly without double-prefixing.
 */
export function formatAsWLyrics(text: string): {
  formatted: string;
  lineCount: number;
  changed: boolean;
} {
  if (!text) return { formatted: text, lineCount: 0, changed: false };

  const rawLines = text.split(/\r?\n/);
  let changed = false;
  let formattedCount = 0;

  const resultLines = rawLines.map((line) => {
    const trimmed = line.trim();

    // Stanza separator
    if (trimmed === '') {
      return 'W:';
    }

    // Already prefixed with W: or w:
    if (/^W:\s*/i.test(trimmed)) {
      const content = trimmed.replace(/^W:\s*/i, '');
      return `W: ${content}`;
    }

    changed = true;
    formattedCount++;
    return `W: ${trimmed}`;
  });

  return {
    formatted: resultLines.join('\n'),
    lineCount: formattedCount,
    changed,
  };
}

/**
 * Toggles "W: " prefix on a multiline block of text (e.g. for selected text in editor).
 * If all non-empty lines already have "W: ", it removes them.
 * Otherwise, it prepends "W: " to all lines.
 */
export function toggleWLyricsOnLines(text: string): {
  result: string;
  action: 'added' | 'removed';
} {
  if (!text) return { result: text, action: 'added' };

  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  const allPrefixed =
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every((l) => /^W:\s*/i.test(l.trim()));

  if (allPrefixed) {
    // Remove W: prefix
    const stripped = lines.map((l) => {
      const trimmed = l.trim();
      if (/^W:\s*/i.test(trimmed)) {
        return trimmed.replace(/^W:\s*/i, '');
      }
      return l;
    });
    return { result: stripped.join('\n'), action: 'removed' };
  } else {
    // Add W: prefix
    const formatted = lines.map((l) => {
      const trimmed = l.trim();
      if (trimmed === '') return 'W:';
      if (/^W:\s*/i.test(trimmed)) return `W: ${trimmed.replace(/^W:\s*/i, '')}`;
      return `W: ${trimmed}`;
    });
    return { result: formatted.join('\n'), action: 'added' };
  }
}
