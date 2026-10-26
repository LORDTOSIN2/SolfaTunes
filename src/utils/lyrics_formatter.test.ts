/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  isLikelyLyricsOrVerse,
  formatAsWLyrics,
  toggleWLyricsOnLines,
} from './lyrics_formatter';

describe('lyrics_formatter', () => {
  describe('isLikelyLyricsOrVerse', () => {
    it('detects standard multi-line hymn verses', () => {
      const verse = `Crown Him with many crowns,
The Lamb upon His throne;
Hark! how the heav'nly anthem drowns
All music but its own.`;
      expect(isLikelyLyricsOrVerse(verse)).toBe(true);
    });

    it('detects verses with stanza numbers', () => {
      const numbered = `1. Holy, holy, holy! Lord God Almighty!
Early in the morning our song shall rise to thee;
2. Holy, holy, holy! Merciful and mighty!
God in three Persons, blessed Trinity!`;
      expect(isLikelyLyricsOrVerse(numbered)).toBe(true);
    });

    it('detects verses with blank lines between stanzas', () => {
      const stanzas = `The day Thou gavest, Lord, is ended,
The darkness falls at Thy behest;

We thank Thee that Thy church, unsleeping,
While earth rolls onward into light.`;
      expect(isLikelyLyricsOrVerse(stanzas)).toBe(true);
    });

    it('detects single-line hymn phrases with multiple words', () => {
      expect(
        isLikelyLyricsOrVerse(
          'Praise to the Lord, the Almighty, the King of creation!'
        )
      ).toBe(true);
    });

    it('does NOT flag ABC notation scores', () => {
      const abc = `X:1
T:Old 100th
M:4/4
K:G
[V:1] G2 G F E D | G2 A2 B2 |]`;
      expect(isLikelyLyricsOrVerse(abc)).toBe(false);
    });

    it('does NOT flag Tonic Sol-fa notation lines with bars and colons', () => {
      const solfa = `KEY Bb   Vienna   M:2/4
S: | s1 : s1 | d : r | m : - |
A: | m1 : m1 | s1 : t1 | d : - |`;
      expect(isLikelyLyricsOrVerse(solfa)).toBe(false);
    });

    it('does NOT flag lines that already have W: on all lines', () => {
      const alreadyW = `W: Blest Creator of the light,
W: Making day with radiance bright,
W:
W: May we ne'er by guilt depressed`;
      expect(isLikelyLyricsOrVerse(alreadyW)).toBe(false);
    });

    it('handles empty or blank text gracefully', () => {
      expect(isLikelyLyricsOrVerse('')).toBe(false);
      expect(isLikelyLyricsOrVerse('   \n  \n ')).toBe(false);
    });
  });

  describe('formatAsWLyrics', () => {
    it('prepends W: to each non-empty line and formats blank lines as W:', () => {
      const input = `Amazing grace! how sweet the sound,
That saved a wretch like me!

I once was lost, but now am found,
Was blind, but now I see.`;

      const { formatted, lineCount, changed } = formatAsWLyrics(input);
      expect(changed).toBe(true);
      expect(lineCount).toBe(4);
      expect(formatted).toBe(
        `W: Amazing grace! how sweet the sound,\nW: That saved a wretch like me!\nW:\nW: I once was lost, but now am found,\nW: Was blind, but now I see.`
      );
    });

    it('does not double prefix lines that already start with W:', () => {
      const mixed = `W: Line already formatted
Second line needs formatting`;
      const { formatted, lineCount, changed } = formatAsWLyrics(mixed);
      expect(changed).toBe(true);
      expect(lineCount).toBe(1);
      expect(formatted).toBe(
        `W: Line already formatted\nW: Second line needs formatting`
      );
    });
  });

  describe('toggleWLyricsOnLines', () => {
    it('adds W: if lines do not have it', () => {
      const input = `Line one\nLine two`;
      const { result, action } = toggleWLyricsOnLines(input);
      expect(action).toBe('added');
      expect(result).toBe(`W: Line one\nW: Line two`);
    });

    it('removes W: if all non-empty lines already have it', () => {
      const input = `W: Line one\nW: Line two`;
      const { result, action } = toggleWLyricsOnLines(input);
      expect(action).toBe('removed');
      expect(result).toBe(`Line one\nLine two`);
    });
  });
});
