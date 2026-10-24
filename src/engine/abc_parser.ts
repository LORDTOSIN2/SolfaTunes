/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedScore, System, VoiceLine, Measure, SolfaNote, VoiceDeclaration, ParseWarning } from '../types';

/**
 * Token interface for the music line tokenizer.
 */
interface MusicToken {
  type: 'voice' | 'bar' | 'note' | 'whitespace';
  value: string;
}

/**
 * Tokenizes a line of music in ABC notation.
 */
export function tokenizeMusicLine(line: string): MusicToken[] {
  const tokens: MusicToken[] = [];
  let i = 0;

  // Regex for a note/rest: 
  // Group 1: optional accidentals (^^, ^, __, _, =)
  // Group 2: note letter (A-G, a-g, z, Z, x, X)
  // Group 3: optional octave marks (', ,)
  // Group 4: optional duration (e.g. 2, 3/2, /2, /)
  const noteRegex = /^([\^=_-]+)?([A-Ga-gzZxX])([',]*)(\d*\/\d+|\/\d+|\d+|\/)?/;

  // Check for barlines (longest first)
  const barSymbols = ['|]', '||', '[|', ':|', '|:', '::', '|'];

  while (i < line.length) {
    const char = line[i];

    // Skip whitespace, but sometimes we want to preserve space boundary between notes
    if (/\s/.test(char)) {
      tokens.push({ type: 'whitespace', value: char });
      i++;
      continue;
    }

    // Inline voice declaration: e.g. [V:S] or [V:Soprano name="Soprano"]
    if (char === '[' && line.substring(i, i + 3) === '[V:') {
      const endIdx = line.indexOf(']', i);
      if (endIdx !== -1) {
        const voiceContent = line.substring(i + 3, endIdx).trim();
        // Extract voice ID (first word)
        const idMatch = voiceContent.match(/^([^\s]+)/);
        const voiceId = idMatch ? idMatch[1] : voiceContent;
        tokens.push({ type: 'voice', value: voiceId });
        i = endIdx + 1;
        continue;
      }
    }

    // Check bar symbols
    let matchedBar = false;
    for (const bar of barSymbols) {
      if (line.substring(i, i + bar.length) === bar) {
        tokens.push({ type: 'bar', value: bar });
        i += bar.length;
        matchedBar = true;
        break;
      }
    }
    if (matchedBar) continue;

    // Check note / rest
    const remaining = line.substring(i);
    const noteMatch = remaining.match(noteRegex);
    if (noteMatch) {
      const tokenValue = noteMatch[0];
      tokens.push({ type: 'note', value: tokenValue });
      i += tokenValue.length;
      continue;
    }

    // Unrecognized character - skip to avoid infinite loop
    i++;
  }

  return tokens;
}

/**
 * Parses raw duration string into numeric multiplier.
 */
export function parseDurationMultiplier(durStr: string | undefined): number {
  if (!durStr) return 1.0;
  
  if (durStr === '/') return 0.5;
  if (durStr.startsWith('/')) {
    const denominator = parseInt(durStr.substring(1), 10);
    return isNaN(denominator) ? 0.5 : 1.0 / denominator;
  }
  
  if (durStr.includes('/')) {
    const parts = durStr.split('/');
    const numerator = parts[0] === '' ? 1.0 : parseFloat(parts[0]);
    const denominator = parseFloat(parts[1]);
    return isNaN(numerator) || isNaN(denominator) ? 1.0 : numerator / denominator;
  }
  
  const val = parseFloat(durStr);
  return isNaN(val) ? 1.0 : val;
}

/**
 * Parses ABC Notation score.
 */
export class AbcParser {
  private title = '';
  private composer = '';
  private key = 'C';
  private meter = '4/4';
  private defaultLength = '1/4';
  private index = '1';
  private voices: VoiceDeclaration[] = [];
  private voicePairingGroups: string[][] = [];
  private warnings: ParseWarning[] = [];

  constructor() {}

  public parse(abcText: string): { score: ParsedScore; warnings: ParseWarning[] } {
    this.title = '';
    this.composer = '';
    this.key = 'C';
    this.meter = '4/4';
    this.defaultLength = '1/4';
    this.index = '1';
    this.voices = [];
    this.voicePairingGroups = [];
    this.warnings = [];

    const lines = abcText.split(/\r?\n/);
    
    let hymnMeter: string | undefined = undefined;
    let tuneName: string | undefined = undefined;
    let hymnName: string | undefined = undefined;
    let verses: number | undefined = undefined;
    let hasDescant: boolean | undefined = undefined;
    const lyrics: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('%')) {
        const hmMatch = line.match(/^%\s*hymn_meter\s*=\s*(.*)$/i);
        if (hmMatch) hymnMeter = hmMatch[1].trim();
        
        const tnMatch = line.match(/^%\s*tune_name\s*=\s*(.*)$/i);
        if (tnMatch) tuneName = tnMatch[1].trim();

        const hnMatch = line.match(/^%\s*hymn_name\s*=\s*(.*)$/i);
        if (hnMatch) hymnName = hnMatch[1].trim();

        const vsMatch = line.match(/^%\s*verses\s*=\s*(\d+)/i);
        if (vsMatch) verses = parseInt(vsMatch[1], 10);

        const hdMatch = line.match(/^%\s*has_descant\s*=\s*(true|false)/i);
        if (hdMatch) hasDescant = hdMatch[1].toLowerCase() === 'true';
      } else if (line.startsWith('W:')) {
        const lyrMatch = line.match(/^W:\s*(.*)$/i);
        if (lyrMatch) {
          lyrics.push(lyrMatch[1]);
        } else {
          lyrics.push('');
        }
      }
    }
    
    // Pass 1: Parse Headers and Voice Declarations
    let bodyStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;

      // Check if this is a header line (must start with letter and colon)
      const headerMatch = line.match(/^([TCMKLEXV]):\s*(.*)$/i);
      
      // Also check %%staves or %%score
      const commentMatch = line.match(/^%%\s*(staves|score)\s+(.*)$/i);

      if (commentMatch) {
        const groupType = commentMatch[1].toLowerCase();
        const groupContent = commentMatch[2];
        this.parseStaves(groupContent);
        continue;
      }

      if (line.startsWith('%')) {
        // Just general comment, not header
        continue;
      }

      if (headerMatch) {
        const type = headerMatch[1].toUpperCase();
        const content = headerMatch[2].trim();

        switch (type) {
          case 'T':
            this.title = content;
            break;
          case 'C':
            this.composer = content;
            break;
          case 'K':
            this.key = content;
            break;
          case 'M':
            this.meter = content;
            break;
          case 'L':
            this.defaultLength = content;
            break;
          case 'X':
            this.index = content;
            break;
          case 'V':
            this.parseVoiceHeader(content);
            break;
        }
      } else {
        // Found first non-header line, music body starts here
        bodyStartIndex = i;
        break;
      }
    }

    // If voices were not declared in the header, look for inline voice IDs in the body
    // and make sure we have at least one default voice if nothing is specified.
    const detectedVoiceIds = new Set<string>();
    for (let i = bodyStartIndex; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('%')) continue;
      if (line.trim().startsWith('W:')) continue;
      
      const tokens = tokenizeMusicLine(line);
      for (const token of tokens) {
        if (token.type === 'voice') {
          detectedVoiceIds.add(token.value);
        }
      }
    }

    // Add implicitly declared voices to the voices list
    detectedVoiceIds.forEach(vid => {
      if (!this.voices.some(v => v.id === vid)) {
        this.voices.push({
          id: vid,
          name: vid,
          clef: 'treble',
          order: this.voices.length
        });
      }
    });

    // If still no voices declared or detected, create a default '1' voice
    if (this.voices.length === 0) {
      this.voices.push({
        id: '1',
        name: 'Melody',
        clef: 'treble',
        order: 0
      });
    }

    // If hasDescant is true, set the grouping default
    if (hasDescant && this.voicePairingGroups.length === 0) {
      const v5 = this.voices.find(v => v.id === '5');
      const v1 = this.voices.find(v => v.id === '1');
      const v2 = this.voices.find(v => v.id === '2');
      const v3 = this.voices.find(v => v.id === '3');
      const v4 = this.voices.find(v => v.id === '4');

      const groups: string[][] = [];
      if (v5) groups.push([v5.id]);
      
      const treble: string[] = [];
      if (v1) treble.push(v1.id);
      if (v2) treble.push(v2.id);
      if (treble.length > 0) groups.push(treble);

      const bass: string[] = [];
      if (v3) bass.push(v3.id);
      if (v4) bass.push(v4.id);
      if (bass.length > 0) groups.push(bass);

      if (groups.length > 0) {
        this.voicePairingGroups = groups;
      }
    } else if (this.voicePairingGroups.length === 0 && this.voices.length > 1) {
      const sVoice = this.voices.find(v => ['S', 'SOPRANO', '1'].includes(v.id.toUpperCase()));
      const aVoice = this.voices.find(v => ['A', 'ALTO', '2'].includes(v.id.toUpperCase()));
      const tVoice = this.voices.find(v => ['T', 'TENOR', '3'].includes(v.id.toUpperCase()));
      const bVoice = this.voices.find(v => ['B', 'BASS', '4'].includes(v.id.toUpperCase()));

      const firstGroup: string[] = [];
      const secondGroup: string[] = [];

      if (sVoice) firstGroup.push(sVoice.id);
      if (aVoice) firstGroup.push(aVoice.id);
      if (tVoice) secondGroup.push(tVoice.id);
      if (bVoice) secondGroup.push(bVoice.id);

      if (firstGroup.length > 0) this.voicePairingGroups.push(firstGroup);
      if (secondGroup.length > 0) this.voicePairingGroups.push(secondGroup);
    }

    // Pass 2: Parse Music Content into Systems and Measures
    const systems: System[] = [];
    let currentSystemIndex = 0;
    
    // Map of active VoiceLines in the system currently being built: voiceId -> Measure[] + barTypes[]
    let currentSystemVoices: { [voiceId: string]: { measures: Measure[]; barTypes: string[] } } = {};
    
    // Global tracking of currently active voice ID (defaulting to the first voice)
    let activeVoiceId = this.voices[0].id;

    for (let i = bodyStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      if (line.startsWith('W:')) continue;

      // Check for System break command in comments
      const isSystemComment = line.startsWith('%') && /System/i.test(line);
      if (isSystemComment) {
        // Force commit current system and start a new one
        if (Object.keys(currentSystemVoices).length > 0) {
          systems.push(this.commitSystem(currentSystemIndex++, currentSystemVoices));
          currentSystemVoices = {};
        }
        continue;
      }

      if (line.startsWith('%')) {
        // Plain comment, skip
        continue;
      }

      // Tokenize the music line
      const tokens = tokenizeMusicLine(lines[i]); // Keep original line for spaces/tabs
      
      // Let's group tokens by measures. A measure consists of note tokens up to a barline.
      let currentMeasureNotes: string[] = [];
      let currentVoiceInLine = activeVoiceId;

      for (let t = 0; t < tokens.length; t++) {
        const token = tokens[t];

        if (token.type === 'voice') {
          // Voice change inline
          const nextVoiceId = token.value;
          
          // If we had notes for the previous voice, wrap them as an open measure and commit
          if (currentMeasureNotes.length > 0) {
            this.addMeasureToVoice(
              currentSystemVoices,
              currentVoiceInLine,
              currentMeasureNotes,
              '|' // Default barline since it was a voice change
            );
            currentMeasureNotes = [];
          }

          // Check if this voice ID is already present in the current system.
          // If so, we must start a NEW system! (Multi-voice interleaving rule)
          if (currentSystemVoices[nextVoiceId]) {
            systems.push(this.commitSystem(currentSystemIndex++, currentSystemVoices));
            currentSystemVoices = {};
          }

          currentVoiceInLine = nextVoiceId;
          activeVoiceId = nextVoiceId; // Update global state
          continue;
        }

        if (token.type === 'note') {
          currentMeasureNotes.push(token.value);
        }

        if (token.type === 'bar') {
          // If this is a leading opening barline at the start of the voice with no notes prior, ignore creating an empty measure
          const existingVoice = currentSystemVoices[currentVoiceInLine];
          const isInitialBarline = currentMeasureNotes.length === 0 && (!existingVoice || existingVoice.measures.length === 0);
          
          if (!isInitialBarline) {
            // Commit notes to the current measure for this voice
            this.addMeasureToVoice(
              currentSystemVoices,
              currentVoiceInLine,
              currentMeasureNotes,
              token.value
            );
          }
          currentMeasureNotes = [];
        }
      }

      // If we finished the line and there are trailing notes (not ended with a barline),
      // we commit them as an open measure.
      if (currentMeasureNotes.length > 0) {
        this.addMeasureToVoice(
          currentSystemVoices,
          currentVoiceInLine,
          currentMeasureNotes,
          '|' // Open end default barline
        );
      }
    }

    // Commit final system if there is any data remaining
    if (Object.keys(currentSystemVoices).length > 0) {
      systems.push(this.commitSystem(currentSystemIndex++, currentSystemVoices));
    }

    // If we have no systems, make sure we have at least one empty system
    if (systems.length === 0) {
      const emptySystem: System = {
        systemIndex: 0,
        voices: {}
      };
      this.voices.forEach(v => {
        emptySystem.voices[v.id] = {
          voiceId: v.id,
          measures: [],
          barTypes: []
        };
      });
      systems.push(emptySystem);
    }

    const score: ParsedScore = {
      title: this.title || 'Untitled Score',
      composer: this.composer || 'Anonymous',
      key: this.key,
      meter: this.meter,
      defaultLength: this.defaultLength,
      index: this.index,
      voices: this.voices.sort((a, b) => {
        if (this.voicePairingGroups.length > 0) {
          const flatGroup = this.voicePairingGroups.flat();
          const idxA = flatGroup.indexOf(a.id);
          const idxB = flatGroup.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
        }
        return a.order - b.order;
      }),
      voicePairingGroups: this.voicePairingGroups,
      systems,
      hymnMeter,
      tuneName,
      hymnName,
      verses,
      hasDescant,
      lyrics
    };

    return { score, warnings: this.warnings };
  }

  /**
   * Commits the temporary active voice maps into a System structure,
   * filling in missing voices to keep systems rectangular and aligned.
   */
  private commitSystem(
    index: number,
    systemVoices: { [voiceId: string]: { measures: Measure[]; barTypes: string[] } }
  ): System {
    const voicesData: { [voiceId: string]: VoiceLine } = {};
    
    // Ensure all declared voices exist in this system
    this.voices.forEach(voice => {
      const vId = voice.id;
      if (systemVoices[vId]) {
        voicesData[vId] = {
          voiceId: vId,
          measures: systemVoices[vId].measures,
          barTypes: systemVoices[vId].barTypes
        };
      } else {
        // Create empty VoiceLine for alignment
        voicesData[vId] = {
          voiceId: vId,
          measures: [],
          barTypes: []
        };
      }
    });

    return {
      systemIndex: index,
      voices: voicesData
    };
  }

  /**
   * Helper to append a parsed measure to a specific voice in our temporary system map.
   */
  private addMeasureToVoice(
    systemVoices: { [voiceId: string]: { measures: Measure[]; barTypes: string[] } },
    voiceId: string,
    rawNotes: string[],
    barType: string
  ) {
    if (!systemVoices[voiceId]) {
      systemVoices[voiceId] = { measures: [], barTypes: [] };
    }

    // Wrap raw notes into custom Note tokens
    const parsedNotes: SolfaNote[] = [];
    const noteRegex = /^([\^=_-]+)?([A-Ga-gzZxX])([',]*)(\d*\/\d+|\/\d+|\d+|\/)?/;

    for (const rawNote of rawNotes) {
      const match = rawNote.match(noteRegex);
      if (match) {
        const accidental = match[1];
        const letter = match[2];
        const octaves = match[3];
        const durationStr = match[4];

        const isRest = ['z', 'Z', 'x', 'X'].includes(letter);
        const commaCount = (octaves.match(/,/g) || []).length;
        const apostropheCount = (octaves.match(/'/g) || []).length;
        const isLowercase = letter === letter.toLowerCase() && !isRest;

        // Compute base octave
        // Lowercase is octave 5, uppercase is octave 4
        const octaveNum = (isLowercase ? 5 : 4) - commaCount + apostropheCount;

        // Compute duration multiplier
        const durationMultiplier = parseDurationMultiplier(durationStr);

        parsedNotes.push({
          syllable: '', // Will be computed in the Solfa Transformer
          scaleDegree: 0,
          midiPitch: 0,
          octaveRelativeToVoice: 0,
          durationTicks: durationMultiplier, // Temporary multiplier, scaled by L during transformation.
          isRest,
          timestamp: 0, // Computed in playback/timing layout
          rawLetter: letter,
          rawAccidental: accidental || undefined,
          octaveNum
        });
      } else {
        this.warnings.push({
          voiceId,
          rawText: rawNote,
          reason: `Failed to parse note token "${rawNote}"`
        });
      }
    }

    systemVoices[voiceId].measures.push({
      notes: parsedNotes,
      rawText: rawNotes.join(' ')
    });
    systemVoices[voiceId].barTypes.push(barType);
  }

  /**
   * Parses voice declarations in the header, e.g.,
   * V:S name="Soprano" clef=treble
   */
  private parseVoiceHeader(content: string) {
    const idMatch = content.match(/^([^\s]+)/);
    if (!idMatch) return;
    const id = idMatch[1];

    const nameMatch = content.match(/name="([^"]+)"/) || content.match(/name=([^\s]+)/);
    const name = nameMatch ? nameMatch[1] : id;

    const clefMatch = content.match(/clef=([^\s]+)/);
    const clef = clefMatch ? clefMatch[1] : 'treble';

    // Prevent duplicate registrations
    if (!this.voices.some(v => v.id === id)) {
      this.voices.push({
        id,
        name,
        clef,
        order: this.voices.length
      });
    }
  }

  /**
   * Parses%%staves [(S A) (T B)] comment.
   */
  private parseStaves(content: string) {
    // Look for parenthesized groupings, e.g., (S A) or (S, A)
    const groups: string[][] = [];
    const groupMatches = content.match(/\(([^)]+)\)/g);
    
    if (groupMatches) {
      for (const match of groupMatches) {
        const inner = match.substring(1, match.length - 1);
        const voiceIds = inner.split(/[\s,]+/).filter(x => x.trim() !== '');
        if (voiceIds.length > 0) {
          groups.push(voiceIds);
        }
      }
    } else {
      // Square bracket style or space-separated fallback
      const clean = content.replace(/[\[\]]/g, '');
      const voiceIds = clean.split(/[\s,]+/).filter(x => x.trim() !== '');
      if (voiceIds.length > 0) {
        // Put all in one group or keep separate
        groups.push(voiceIds);
      }
    }

    if (groups.length > 0) {
      this.voicePairingGroups = groups;
    }
  }
}
