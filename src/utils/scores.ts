interface ScoreLibraryItemBase {
  id: string;
  fileName: string;
  title: string;
  composer: string;
  hymnMeter?: string;
  timeMeter?: string;
  hymnName?: string;
  tuneName?: string;
}

export interface AbcScoreLibraryItem extends ScoreLibraryItemBase {
  format: 'abc';
  abcText: string;
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
  eager: true,
  query: '?raw',
  import: 'default',
});

function readField(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[1]?.trim();
}

export function getStandardHymnMeter(nameOrTitle: string): string | undefined {
  const norm = nameOrTitle.toLowerCase();
  if (norm.includes('franconia')) return '8.6.8.6';
  if (norm.includes('vienna')) return '7.7.7.7';
  if (norm.includes('stuttgart')) return '8.7.8.7';
  if (norm.includes('morning')) return '8.8.8.8';
  if (norm.includes('illsley')) return '8.8.8.8';
  if (norm.includes('winchester')) return '8.8.8.8';
  return undefined;
}

function extractMusicXmlMeta(xml: string) {
  let hymnMeter: string | undefined;
  let hymnName: string | undefined;
  let tuneName: string | undefined;
  let composer: string | undefined;
  let timeMeter: string | undefined;

  // 1. solfatunes:hymn JSON
  const hymnJsonMatch = xml.match(/<miscellaneous-field name="solfatunes:hymn">([\s\S]*?)<\/miscellaneous-field>/);
  if (hymnJsonMatch) {
    try {
      const decoded = hymnJsonMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      const parsed = JSON.parse(decoded);
      if (parsed.hymnMeter) hymnMeter = parsed.hymnMeter;
      if (parsed.hymnName) hymnName = parsed.hymnName;
      if (parsed.tuneName) tuneName = parsed.tuneName;
    } catch {}
  }

  // 2. originalAbcSource in miscellaneous field
  if (!hymnMeter) {
    const meterMatch = xml.match(/%\s*hymn_meter\s*=\s*([^\r\n<]+)/i);
    if (meterMatch) hymnMeter = meterMatch[1].trim();
  }
  if (!hymnName) {
    const hNameMatch = xml.match(/%\s*hymn_name\s*=\s*([^\r\n<]+)/i);
    if (hNameMatch) hymnName = hNameMatch[1].trim();
  }
  if (!tuneName) {
    const tNameMatch = xml.match(/%\s*tune_name\s*=\s*([^\r\n<]+)/i);
    if (tNameMatch) tuneName = tNameMatch[1].trim();
  }

  // 3. Time meter
  const beats = xml.match(/<beats>(\d+)<\/beats>/)?.[1];
  const beatType = xml.match(/<beat-type>(\d+)<\/beat-type>/)?.[1];
  if (beats && beatType) {
    timeMeter = `${beats}/${beatType}`;
  }

  // 4. Composer
  const creatorMatch = xml.match(/<creator type="composer">([^<]+)<\/creator>/);
  if (creatorMatch) {
    composer = creatorMatch[1].trim();
  }

  return { hymnMeter, hymnName, tuneName, composer, timeMeter };
}

export function createAbcScoreLibraryItem(path: string, abcText: string): AbcScoreLibraryItem {
  const fileName = path.split('/').pop() || path;
  const tuneName = readField(abcText, /^%\s*tune_name\s*=\s*(.+)$/im);
  const title = readField(abcText, /^T:\s*(.+)$/im) || fileName.replace(/\.[^.]+$/, '');
  const hymnMeter =
    readField(abcText, /^%\s*hymn_meter\s*=\s*(.+)$/im) ||
    readField(abcText, /^%\s*meter\s*=\s*(.+)$/im) ||
    getStandardHymnMeter(tuneName || title);

  return {
    id: `abc:${fileName.replace(/\.(?:abc|txt)$/i, '')}`,
    fileName,
    format: 'abc',
    title,
    composer: readField(abcText, /^C:\s*(.+)$/im) || 'Composer unknown',
    abcText,
    hymnMeter,
    timeMeter: readField(abcText, /^M:\s*(.+)$/im),
    hymnName: readField(abcText, /^%\s*hymn_name\s*=\s*(.+)$/im),
    tuneName,
  };
}

export function createMusicXmlScoreLibraryItem(
  path: string,
  loadXmlOrRaw: (() => Promise<string>) | string
): MusicXmlScoreLibraryItem {
  const fileName = path.split('/').pop() || path;
  const fileTitle = fileName
    .replace(/\.(?:xml|musicxml)$/i, '')
    .replace(/^\d+\s*-\s*/, '')
    .replace(/_/g, ' ')
    .trim();

  const isRawString = typeof loadXmlOrRaw === 'string';
  const rawXml = isRawString ? loadXmlOrRaw : undefined;
  const loadXml = isRawString ? () => Promise.resolve(loadXmlOrRaw) : loadXmlOrRaw;

  const meta: Partial<ReturnType<typeof extractMusicXmlMeta>> = rawXml
    ? extractMusicXmlMeta(rawXml)
    : {};
  const hymnMeter = meta.hymnMeter || getStandardHymnMeter(meta.tuneName || fileTitle);

  return {
    id: `musicxml:${fileName.replace(/\.(?:xml|musicxml)$/i, '')}`,
    fileName,
    format: 'musicxml',
    title: fileTitle,
    composer: meta.composer || 'MusicXML project',
    hymnMeter,
    timeMeter: meta.timeMeter,
    hymnName: meta.hymnName,
    tuneName: meta.tuneName,
    loadXml,
  };
}

export const ABC_SCORES: AbcScoreLibraryItem[] = Object.entries(abcScoreFiles)
  .map(([path, abcText]) => createAbcScoreLibraryItem(path, abcText))
  .sort((a, b) => getScoreDisplayTitle(a, 'hymn').localeCompare(getScoreDisplayTitle(b, 'hymn')));

export const SCORES: ScoreLibraryItem[] = [
  ...ABC_SCORES,
  ...Object.entries(musicXmlScoreFiles).map(([path, rawXml]) =>
    createMusicXmlScoreLibraryItem(path, rawXml)
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
