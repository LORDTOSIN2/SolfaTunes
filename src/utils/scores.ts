interface ScoreLibraryItemBase {
  id: string;
  fileName: string;
  title: string;
  composer: string;
}

export interface AbcScoreLibraryItem extends ScoreLibraryItemBase {
  format: 'abc';
  abcText: string;
  hymnName?: string;
  tuneName?: string;
}

export interface MusicXmlScoreLibraryItem extends ScoreLibraryItemBase {
  format: 'musicxml';
  loadXml: () => Promise<string>;
}

export type ScoreLibraryItem = AbcScoreLibraryItem | MusicXmlScoreLibraryItem;
export type ScoreTitleMode = 'hymn' | 'tune';

const abcScoreFiles = import.meta.glob<string>('../../scores/*.{abc,txt}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const musicXmlScoreFiles = import.meta.glob<string>('../../scores/*.{xml,musicxml}', {
  query: '?raw',
  import: 'default',
});

function readField(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1]?.trim();
}

export function createAbcScoreLibraryItem(path: string, abcText: string): AbcScoreLibraryItem {
  const fileName = path.split('/').pop() || path;

  return {
    id: `abc:${fileName.replace(/\.(?:abc|txt)$/i, '')}`,
    fileName,
    format: 'abc',
    title: readField(abcText, /^T:\s*(.+)$/im) || fileName.replace(/\.[^.]+$/, ''),
    composer: readField(abcText, /^C:\s*(.+)$/im) || 'Composer unknown',
    abcText,
    hymnName: readField(abcText, /^%\s*hymn_name\s*=\s*(.+)$/im),
    tuneName: readField(abcText, /^%\s*tune_name\s*=\s*(.+)$/im),
  };
}

export function createMusicXmlScoreLibraryItem(
  path: string,
  loadXml: () => Promise<string>
): MusicXmlScoreLibraryItem {
  const fileName = path.split('/').pop() || path;
  const fileTitle = fileName
    .replace(/\.(?:xml|musicxml)$/i, '')
    .replace(/^\d+\s*-\s*/, '')
    .replace(/_/g, ' ')
    .trim();

  return {
    id: `musicxml:${fileName.replace(/\.(?:xml|musicxml)$/i, '')}`,
    fileName,
    format: 'musicxml',
    title: fileTitle,
    composer: 'MusicXML project',
    loadXml,
  };
}

export const ABC_SCORES: AbcScoreLibraryItem[] = Object.entries(abcScoreFiles)
  .map(([path, abcText]) => createAbcScoreLibraryItem(path, abcText))
  .sort((a, b) => getScoreDisplayTitle(a, 'hymn').localeCompare(getScoreDisplayTitle(b, 'hymn')));

export const SCORES: ScoreLibraryItem[] = [
  ...ABC_SCORES,
  ...Object.entries(musicXmlScoreFiles).map(([path, loadXml]) =>
    createMusicXmlScoreLibraryItem(path, loadXml)
  ),
]
  .sort((a, b) => getScoreDisplayTitle(a, 'hymn').localeCompare(getScoreDisplayTitle(b, 'hymn')));

export function getScoreDisplayTitle(
  score: ScoreLibraryItem,
  mode: ScoreTitleMode
): string {
  if (score.format === 'musicxml') return score.title;
  return mode === 'hymn' ? score.hymnName || score.title : score.tuneName || score.title;
}
