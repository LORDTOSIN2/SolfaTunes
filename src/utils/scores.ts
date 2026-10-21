export interface ScoreLibraryItem {
  id: string;
  fileName: string;
  title: string;
  composer: string;
  abcText: string;
  hymnName?: string;
  tuneName?: string;
}

export type ScoreTitleMode = 'hymn' | 'tune';

const scoreFiles = import.meta.glob<string>('../../scores/*.{abc,txt}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function readField(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1]?.trim();
}

export const SCORES: ScoreLibraryItem[] = Object.entries(scoreFiles)
  .map(([path, abcText]) => {
    const fileName = path.split('/').pop() || path;

    return {
      id: fileName.replace(/\.(?:abc|txt)$/i, ''),
      fileName,
      title: readField(abcText, /^T:\s*(.+)$/im) || fileName.replace(/\.[^.]+$/, ''),
      composer: readField(abcText, /^C:\s*(.+)$/im) || 'Composer unknown',
      abcText,
      hymnName: readField(abcText, /^%\s*hymn_name\s*=\s*(.+)$/im),
      tuneName: readField(abcText, /^%\s*tune_name\s*=\s*(.+)$/im),
    };
  })
  .sort((a, b) => getScoreDisplayTitle(a, 'hymn').localeCompare(getScoreDisplayTitle(b, 'hymn')));

export function getScoreDisplayTitle(
  score: ScoreLibraryItem,
  mode: ScoreTitleMode
): string {
  return mode === 'hymn'
    ? score.hymnName || score.title
    : score.tuneName || score.title;
}
