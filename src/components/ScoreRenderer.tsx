/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ParsedScore, System, VoiceLine, Measure, SolfaNote, SelectedNoteLocation } from '../types';
import { SolfaTransformer } from '../engine/solfa_transformer';
import { ZoomIn, ZoomOut, Type, Music, X, HelpCircle, Eye, Edit2 } from 'lucide-react';

interface ScoreRendererProps {
  score: ParsedScore | null;
  currentEighth: number;
  fontSize: number;
  setFontSize: (size: number) => void;
  scale: number;
  setScale: (scale: number) => void;
  mutedVoices: { [voiceId: string]: boolean };
  toggleMute: (voiceId: string) => void;
  selectedNote: SelectedNoteLocation | null;
  onSelectNote: (location: SelectedNoteLocation | null) => void;
  onUpdateScore: (score: ParsedScore) => void;
  isEditorMode: boolean;
  setIsEditorMode: (val: boolean) => void;
}

const solfaSyllables = [
  'd', 'di', 'r', 'ri', 'm', 'f', 'fi', 's', 'si', 'l', 'li', 't'
];

/**
 * Computes the pitch class of "d" (Do) for the given key signature,
 * handling major/minor (La-based minor) correctly.
 */
function getTonicPitchClass(key: string): number {
  const clean = key.trim();
  const base = clean.charAt(0).toUpperCase();
  let modifier = '';
  if (clean.length > 1 && (clean.charAt(1) === '#' || clean.charAt(1).toLowerCase() === 'b')) {
    modifier = clean.charAt(1).toLowerCase() === 'b' ? 'b' : '#';
  }
  
  let basePc = 0;
  switch (base) {
    case 'C': basePc = 0; break;
    case 'D': basePc = 2; break;
    case 'E': basePc = 4; break;
    case 'F': basePc = 5; break;
    case 'G': basePc = 7; break;
    case 'A': basePc = 9; break;
    case 'B': basePc = 11; break;
  }
  
  if (modifier === '#') basePc = (basePc + 1) % 12;
  if (modifier === 'b') basePc = (basePc + 11) % 12;
  
  const isMinor = /m|min|minor/i.test(clean);
  if (isMinor) {
    // Relative major tonic is 3 semitones above relative minor root
    return (basePc + 3) % 12;
  }
  return basePc;
}

/**
 * Maps a pitch class 0-11 to a standard note letter and raw accidental.
 */
function getLetterAndAccidentalForPitch(pc: number): { letter: string; accidental?: string } {
  const mappings: { [pc: number]: { letter: string; accidental?: string } } = {
    0: { letter: 'C' },
    1: { letter: 'C', accidental: '^' },
    2: { letter: 'D' },
    3: { letter: 'D', accidental: '^' },
    4: { letter: 'E' },
    5: { letter: 'F' },
    6: { letter: 'F', accidental: '^' },
    7: { letter: 'G' },
    8: { letter: 'G', accidental: '^' },
    9: { letter: 'A' },
    10: { letter: 'A', accidental: '^' },
    11: { letter: 'B' }
  };
  return mappings[pc];
}

/**
 * Parses default note length, e.g., "1/4" -> 0.25
 */
function parseDefaultLength(lengthStr: string): number {
  if (!lengthStr || !lengthStr.includes('/')) return 0.25;
  const parts = lengthStr.split('/');
  const num = parseFloat(parts[0]);
  const den = parseFloat(parts[1]);
  return isNaN(num) || isNaN(den) ? 0.25 : num / den;
}

interface InteractiveRhythmLineProps {
  measure: Measure;
  meterDenominator: number;
  systemIndex: number;
  voiceId: string;
  measureIndex: number;
  selectedNote: SelectedNoteLocation | null;
  onSelectNote: (location: SelectedNoteLocation | null) => void;
  isPlaying: boolean;
  isMuted: boolean;
  isEditorMode: boolean;
}

const InteractiveRhythmLine: React.FC<InteractiveRhythmLineProps> = ({
  measure,
  meterDenominator,
  systemIndex,
  voiceId,
  measureIndex,
  selectedNote,
  onSelectNote,
  isPlaying,
  isMuted,
  isEditorMode
}) => {
  const notes = measure.notes;
  if (notes.length === 0) return <>{"\u00A0"}</>;

  const beatEighths = Math.max(1, Math.round(8 / meterDenominator));

  // Map each note to its relative start/end in the measure
  let currentOffset = 0;
  const timeline = notes.map((note, index) => {
    const start = currentOffset;
    currentOffset += note.durationInEighths;
    return {
      note,
      index,
      start,
      end: currentOffset
    };
  });

  const totalEighths = currentOffset;
  const cells: React.ReactNode[] = [];

  // Walk the timeline in chunks of beatEighths
  let cellIdx = 0;
  for (let cellStart = 0; cellStart < totalEighths; cellStart += beatEighths) {
    const cellEnd = cellStart + beatEighths;

    // Check if a note starts BEFORE cellStart and continues INTO cellStart
    const sustainedNote = timeline.find(t => t.start < cellStart && t.end > cellStart);

    if (sustainedNote && !sustainedNote.note.isRest) {
      // Sustained note spanning across the beat cell start boundary
      const isSelected =
        selectedNote &&
        selectedNote.systemIndex === systemIndex &&
        selectedNote.voiceId === voiceId &&
        selectedNote.measureIndex === measureIndex &&
        selectedNote.noteIndex === sustainedNote.index;

      cells.push(
        <button
          key={`cell-${cellIdx}`}
          onClick={isEditorMode ? (e) => {
            e.stopPropagation();
            onSelectNote({
              systemIndex,
              voiceId,
              measureIndex,
              noteIndex: sustainedNote.index
            });
          } : undefined}
          disabled={!isEditorMode}
          className={`inline-block px-1 rounded font-serif font-black transition-all duration-150 text-center ${
            isMuted ? 'pointer-events-none' : ''
          } ${
            isEditorMode && !isMuted ? 'cursor-pointer hover:bg-indigo-100' : ''
          } ${
            isSelected
              ? 'bg-[#6366F1] text-white ring-2 ring-[#818CF8]/80 scale-[1.12] shadow-md font-extrabold z-10'
              : isPlaying
              ? 'text-[#6366F1]'
              : 'text-black'
          }`}
          style={{ minWidth: '1.25rem' }}
          title={isEditorMode ? "Sustained note. Click to edit." : "Sustained note"}
        >
          -
        </button>
      );
    } else {
      // Find notes that start within this beat cell
      const startingInCell = timeline.filter(t => t.start >= cellStart && t.start < cellEnd);

      if (startingInCell.length === 0) {
        if (sustainedNote && sustainedNote.note.isRest) {
          const isSelected =
            selectedNote &&
            selectedNote.systemIndex === systemIndex &&
            selectedNote.voiceId === voiceId &&
            selectedNote.measureIndex === measureIndex &&
            selectedNote.noteIndex === sustainedNote.index;

          cells.push(
            <button
              key={`cell-${cellIdx}`}
              onClick={isEditorMode ? (e) => {
                e.stopPropagation();
                onSelectNote({
                  systemIndex,
                  voiceId,
                  measureIndex,
                  noteIndex: sustainedNote.index
                });
              } : undefined}
              disabled={!isEditorMode}
              className={`inline-block px-1 rounded font-serif font-black transition-all duration-150 text-center ${
                isMuted ? 'pointer-events-none' : ''
              } ${
                isEditorMode && !isMuted ? 'cursor-pointer hover:bg-indigo-100' : ''
              } ${
                isSelected
                  ? 'bg-[#6366F1] text-white ring-2 ring-[#818CF8]/80 scale-[1.12] shadow-md font-extrabold z-10'
                  : isPlaying
                  ? 'text-[#6366F1]'
                  : 'text-black'
              }`}
              style={{ minWidth: '1.25rem' }}
              title={isEditorMode ? "Rest. Click to edit." : "Rest"}
            >
              ·
            </button>
          );
        } else {
          cells.push(
            <span key={`cell-${cellIdx}`} className="text-black/20 font-light select-none px-1">
              -
            </span>
          );
        }
      } else {
        // Format the starting notes
        const noteSpans: React.ReactNode[] = [];

        startingInCell.forEach((t, partIdx) => {
          const isSelected =
            selectedNote &&
            selectedNote.systemIndex === systemIndex &&
            selectedNote.voiceId === voiceId &&
            selectedNote.measureIndex === measureIndex &&
            selectedNote.noteIndex === t.index;

          // Format syllable with combining diacritics for octave display
          let text = t.note.syllable;
          const diff = t.note.octaveRelativeToVoice;

          if (diff > 0) {
            const dots = '\u0307'.repeat(Math.min(diff, 2));
            text = text.charAt(0) + dots + text.substring(1);
          } else if (diff < 0) {
            const dots = '\u0323'.repeat(Math.min(Math.abs(diff), 2));
            text = text.charAt(0) + dots + text.substring(1);
          }

          noteSpans.push(
            <button
              key={`note-part-${t.index}`}
              onClick={isEditorMode ? (e) => {
                e.stopPropagation();
                onSelectNote({
                  systemIndex,
                  voiceId,
                  measureIndex,
                  noteIndex: t.index
                });
              } : undefined}
              disabled={!isEditorMode}
              className={`inline-block px-1.5 py-0.5 rounded font-serif font-black transition-all duration-150 text-center ${
                isMuted ? 'pointer-events-none' : ''
              } ${
                isEditorMode && !isMuted ? 'cursor-pointer hover:bg-indigo-100' : ''
              } ${
                isSelected
                  ? 'bg-[#6366F1] text-white ring-2 ring-[#818CF8]/80 scale-[1.12] shadow-md font-extrabold z-10'
                  : isPlaying
                  ? 'text-[#6366F1]'
                  : 'text-black'
              }`}
              title={isEditorMode ? `Note: ${text}. Click to edit.` : `Note: ${text}`}
            >
              {text}
            </button>
          );

          if (partIdx < startingInCell.length - 1) {
            noteSpans.push(
              <span key={`dot-${t.index}`} className="text-black/30 font-light select-none px-0.5">
                .
              </span>
            );
          }
        });

        cells.push(
          <span key={`cell-${cellIdx}`} className="inline-flex items-center">
            {noteSpans}
          </span>
        );
      }
    }

    cellIdx++;
  }

  // Separator rendering
  const renderedElements: React.ReactNode[] = [];
  cells.forEach((cell, idx) => {
    renderedElements.push(cell);
    if (idx < cells.length - 1) {
      renderedElements.push(
        <span key={`sep-${idx}`} className="mx-2 text-black/30 font-light select-none">
          :
        </span>
      );
    }
  });

  return <div className="inline-flex items-center select-none">{renderedElements}</div>;
};

/**
 * Custom visual representation of a barline.
 */
const BarlineGraphic: React.FC<{ type: string; height: number }> = ({ type, height }) => {
  const lineStyle = { height: `${height}px` };

  switch (type) {
    case '||': // Section boundary
      return (
        <div className="flex items-center justify-center gap-1 px-1.5 h-full">
          <div className="w-[2px] bg-black" style={lineStyle} />
          <div className="w-[2px] bg-black" style={lineStyle} />
        </div>
      );
    case '|]': // Final bar
      return (
        <div className="flex items-center justify-center gap-1.5 px-2 h-full">
          <div className="w-[1.5px] bg-black" style={lineStyle} />
          <div className="w-[5px] bg-black rounded-sm" style={lineStyle} />
        </div>
      );
    case ':|': // Repeat end
      return (
        <div className="flex items-center justify-center gap-1 px-1.5 h-full relative">
          <div className="flex flex-col gap-1.5 justify-center mr-1">
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
          </div>
          <div className="w-[1.5px] bg-black" style={lineStyle} />
          <div className="w-[4px] bg-black" style={lineStyle} />
        </div>
      );
    case '|:': // Repeat start
      return (
        <div className="flex items-center justify-center gap-1 px-1.5 h-full relative">
          <div className="w-[4px] bg-black" style={lineStyle} />
          <div className="w-[1.5px] bg-black" style={lineStyle} />
          <div className="flex flex-col gap-1.5 justify-center ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
          </div>
        </div>
      );
    case '::': // Dual repeat
      return (
        <div className="flex items-center justify-center gap-1 px-2 h-full">
          <div className="flex flex-col gap-1.5 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
          </div>
          <div className="w-[1.5px] bg-black" style={lineStyle} />
          <div className="w-[1.5px] bg-black" style={lineStyle} />
          <div className="flex flex-col gap-1.5 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
          </div>
        </div>
      );
    case '|': // Standard barline
    default:
      return (
        <div className="flex items-center justify-center px-1.5 h-full">
          <div className="w-[1.5px] bg-black/20" style={lineStyle} />
        </div>
      );
  }
};

/**
 * Container that enforces single-row display and automatically scales
 * measures down if they overflow the available width.
 */
interface AutoscalingMeasuresProps {
  systemHeight: number;
  children: React.ReactNode;
}

const AutoscalingMeasures: React.FC<AutoscalingMeasuresProps> = ({ systemHeight, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const updateScale = () => {
      const containerWidth = container.getBoundingClientRect().width;
      
      const prevTransform = content.style.transform;
      content.style.transform = 'none';
      const contentWidth = content.scrollWidth || content.getBoundingClientRect().width;
      content.style.transform = prevTransform;

      if (contentWidth > containerWidth && containerWidth > 0) {
        const newScale = containerWidth / contentWidth;
        setScale(newScale);
        content.style.transform = `scale(${newScale})`;
      } else {
        setScale(1);
        content.style.transform = 'none';
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    resizeObserver.observe(container);
    resizeObserver.observe(content);

    updateScale();

    return () => {
      resizeObserver.disconnect();
    };
  }, [children]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      style={{ height: `${systemHeight * scale}px`, transition: 'height 150ms ease-out' }}
    >
      <div
        ref={contentRef}
        className="flex flex-row flex-nowrap justify-between w-max min-w-full origin-top-left transition-transform duration-150 ease-out"
        style={{ height: `${systemHeight}px` }}
      >
        {children}
      </div>
    </div>
  );
};

export const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  currentEighth,
  fontSize,
  setFontSize,
  scale,
  setScale,
  mutedVoices,
  toggleMute,
  selectedNote,
  onSelectNote,
  onUpdateScore,
  isEditorMode,
  setIsEditorMode
}) => {
  // 1. Calculate measure tick ranges to highlight active measures
  const measureRanges = useMemo(() => {
    if (!score || score.voices.length === 0) return [];

    const ranges: {
      systemIndex: number;
      measureIndex: number;
      start: number;
      end: number;
    }[] = [];

    // Let's use the first voice's measures as the timeline reference
    const refVoiceId = score.voices[0].id;
    let globalOffset = 0;

    score.systems.forEach((system) => {
      const line = system.voices[refVoiceId];
      if (!line) return;

      line.measures.forEach((measure, mIndex) => {
        // Calculate length of this measure in eighths
        let measureLen = 0;
        measure.notes.forEach((note) => {
          measureLen += note.durationInEighths;
        });

        ranges.push({
          systemIndex: system.systemIndex,
          measureIndex: mIndex,
          start: globalOffset,
          end: globalOffset + measureLen
        });

        globalOffset += measureLen;
      });
    });

    return ranges;
  }, [score]);

  // Find currently active measure
  const activeMeasure = useMemo(() => {
    return measureRanges.find(
      (r) => currentEighth >= r.start && currentEighth < r.end
    );
  }, [measureRanges, currentEighth]);

  const selectedNoteObj = useMemo(() => {
    if (!score || !selectedNote) return null;
    try {
      const system = score.systems[selectedNote.systemIndex];
      const voice = system?.voices[selectedNote.voiceId];
      const measure = voice?.measures[selectedNote.measureIndex];
      const note = measure?.notes[selectedNote.noteIndex];
      return note || null;
    } catch {
      return null;
    }
  }, [score, selectedNote]);

  const handleUpdateNoteSyllable = (syllable: string) => {
    if (!score || !selectedNote) return;
    
    const newScore = JSON.parse(JSON.stringify(score)) as ParsedScore;
    const note = newScore.systems[selectedNote.systemIndex]
      .voices[selectedNote.voiceId]
      .measures[selectedNote.measureIndex]
      .notes[selectedNote.noteIndex];
      
    if (syllable === 'rest') {
      note.isRest = true;
      note.rawLetter = 'z';
      note.rawAccidental = undefined;
      note.syllable = '·';
    } else {
      note.isRest = false;
      note.syllable = syllable;
      const tonicPc = getTonicPitchClass(score.key);
      const degreeIdx = solfaSyllables.indexOf(syllable);
      if (degreeIdx !== -1) {
        const targetPc = (tonicPc + degreeIdx) % 12;
        const mapping = getLetterAndAccidentalForPitch(targetPc);
        note.rawLetter = mapping.letter;
        note.rawAccidental = mapping.accidental;
      }
    }
    
    onUpdateScore(newScore);
  };

  const handleUpdateNoteOctave = (direction: number) => {
    if (!score || !selectedNote || !selectedNoteObj) return;
    
    const currentOct = selectedNoteObj.octaveNum !== undefined ? selectedNoteObj.octaveNum : 4;
    const newOct = Math.min(7, Math.max(2, currentOct + direction));
    if (newOct === currentOct) return;
    
    const newScore = JSON.parse(JSON.stringify(score)) as ParsedScore;
    const note = newScore.systems[selectedNote.systemIndex]
      .voices[selectedNote.voiceId]
      .measures[selectedNote.measureIndex]
      .notes[selectedNote.noteIndex];
      
    note.octaveNum = newOct;
    onUpdateScore(newScore);
  };

  const handleUpdateNoteDuration = (mult: number) => {
    if (!score || !selectedNote) return;
    
    const newScore = JSON.parse(JSON.stringify(score)) as ParsedScore;
    const note = newScore.systems[selectedNote.systemIndex]
      .voices[selectedNote.voiceId]
      .measures[selectedNote.measureIndex]
      .notes[selectedNote.noteIndex];
      
    const defaultLengthVal = parseDefaultLength(score.defaultLength);
    note.durationInEighths = Math.round(mult * defaultLengthVal * 8);
    if (note.durationInEighths <= 0) note.durationInEighths = 1;
    
    onUpdateScore(newScore);
  };

  if (!score) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-stone-500 p-8 bg-[#0F1115]">
        <p className="text-xl font-serif italic text-white/40">No score loaded</p>
        <p className="text-xs text-white/20 mt-1">Enter ABC notation or load an masterpiece on the left.</p>
      </div>
    );
  }

  // Parse time signature denominator for rhythm subdivision (default to 4)
  const meterDen = parseInt(score.meter.split('/')[1], 10) || 4;

  // Render bracket groupings on the left of systems
  const renderBrackets = (system: System, group: string[], index: number) => {
    const presentVoiceIds = score.voices
      .map((v) => v.id)
      .filter((vid) => group.includes(vid) && system.voices[vid]);

    if (presentVoiceIds.length <= 1) return null;

    // Curly bracket grouping
    return (
      <div
        className="absolute -left-4 top-1 bottom-1 w-2.5 text-black transition-all"
        key={`bracket-group-${index}`}
      >
        <svg
          className="w-full h-full"
          viewBox="0 0 10 100"
          preserveAspectRatio="none"
        >
          <path
            d="M8,2 C4,2 2,6 2,12 L2,44 C2,48 5,50 8,50 C5,50 2,52 2,56 L2,88 C2,94 4,98 8,98"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#13151A] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
      {/* Renderer Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 bg-[#0F1115] border-b border-white/5">
        <div>
          <h2 className="text-white font-sans font-black text-xs uppercase tracking-wider">
            Sol-fa Sheet Music
          </h2>
          <p className="text-[11px] text-stone-400 font-sans mt-0.5">
            Key: <span className="font-bold text-[#6366F1]">{score.key}</span> | Meter:{' '}
            <span className="font-semibold text-stone-300">{score.meter}</span> | L:{' '}
            <span className="font-semibold text-stone-300">{score.defaultLength}</span>
          </p>
        </div>

        {/* Zoom and Size Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Mode Toggle Segmented Control */}
          <div className="flex items-center bg-black/40 p-1 rounded-full border border-white/10 shadow-inner">
            <button
              onClick={() => {
                setIsEditorMode(false);
                onSelectNote(null);
              }}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-sans font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                !isEditorMode
                  ? 'bg-[#1C1E24] text-white shadow border border-white/10'
                  : 'text-stone-400 hover:text-white'
              }`}
              title="Switch to View/Read Mode"
            >
              <Eye size={12} />
              Read Only
            </button>
            <button
              onClick={() => setIsEditorMode(true)}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-sans font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                isEditorMode
                  ? 'bg-indigo-600 text-white shadow ring-1 ring-indigo-400/30'
                  : 'text-stone-400 hover:text-indigo-400'
              }`}
              title="Switch to Visual Edit Mode"
            >
              <Edit2 size={12} />
              Interactive Editor
            </button>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-full border border-white/10 shadow-inner">
            <button
              onClick={() => setScale(Math.max(0.6, scale - 0.1))}
              className="p-1.5 hover:bg-white/10 rounded-full text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono font-bold text-[#6366F1] w-10 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(Math.min(1.8, scale + 0.1))}
              className="p-1.5 hover:bg-white/10 rounded-full text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Font Size Controls */}
          <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-full border border-white/10 shadow-inner">
            <button
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              className="p-1.5 hover:bg-white/10 rounded-full text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Decrease Font Size"
            >
              <Type size={12} className="scale-75" />
            </button>
            <span className="text-[11px] font-mono font-bold text-[#6366F1] w-12 text-center">
              {fontSize}px
            </span>
            <button
              onClick={() => setFontSize(Math.min(28, fontSize + 2))}
              className="p-1.5 hover:bg-white/10 rounded-full text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Increase Font Size"
            >
              <Type size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Sheet Music Visual Area */}
      <div className="flex-1 overflow-auto p-8 relative bg-[#0A0A0B]">
        {selectedNote && selectedNoteObj && (
          <div className="mx-auto max-w-4xl mb-8 bg-[#161920] border border-white/10 rounded-2xl p-6 shadow-2xl relative text-white sticky top-0 z-30 transition-all duration-300">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Music size={18} />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-sm tracking-tight">
                    Inline Note Inspector & Visual Editor
                  </h3>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Editing <span className="text-indigo-400 font-semibold">{score.voices.find(v => v.id === selectedNote.voiceId)?.name || selectedNote.voiceId}</span> voice | Measure <span className="text-indigo-400 font-semibold">{selectedNote.measureIndex + 1}</span>, Note <span className="text-indigo-400 font-semibold">{selectedNote.noteIndex + 1}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSelectNote(null)}
                className="p-1.5 hover:bg-white/10 rounded-full text-stone-400 hover:text-white transition-colors cursor-pointer"
                title="Close Inspector"
              >
                <X size={16} />
              </button>
            </div>

            {/* Editing grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Col 1: Solfa Syllables Select */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                  Tonic Sol-fa Syllable (Scale Degree)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {solfaSyllables.map((syl) => {
                    const isSelected = !selectedNoteObj.isRest && selectedNoteObj.syllable === syl;
                    return (
                      <button
                        key={`syl-btn-${syl}`}
                        onClick={() => handleUpdateNoteSyllable(syl)}
                        className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-lg ring-2 ring-indigo-400/50 scale-[1.04]'
                            : 'bg-white/5 text-stone-300 border border-white/5 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {syl}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handleUpdateNoteSyllable('rest')}
                    className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-150 cursor-pointer ${
                      selectedNoteObj.isRest
                        ? 'bg-red-600 text-white shadow-lg ring-2 ring-red-400/50 scale-[1.04]'
                        : 'bg-white/5 text-stone-300 border border-white/5 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Rest (·)
                  </button>
                </div>
              </div>

              {/* Col 2: Octave and Duration */}
              <div className="space-y-4">
                {/* Octave Controls */}
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                    Octave Register
                  </label>
                  <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/5 max-w-[180px]">
                    <button
                      onClick={() => handleUpdateNoteOctave(-1)}
                      className="flex-1 py-1.5 hover:bg-white/5 rounded-lg text-stone-300 hover:text-white font-black text-sm cursor-pointer"
                      title="Lower octave"
                    >
                      -
                    </button>
                    <span className="px-3 font-mono font-bold text-xs text-indigo-400">
                      Octave {selectedNoteObj.octaveNum !== undefined ? selectedNoteObj.octaveNum : 4}
                    </span>
                    <button
                      onClick={() => handleUpdateNoteOctave(1)}
                      className="flex-1 py-1.5 hover:bg-white/5 rounded-lg text-stone-300 hover:text-white font-black text-sm cursor-pointer"
                      title="Raise octave"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Duration Controls */}
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                    Note Duration (Beats)
                  </label>
                  <select
                    value={selectedNoteObj ? (selectedNoteObj.durationInEighths / (parseDefaultLength(score.defaultLength) * 8)) : 1.0}
                    onChange={(e) => handleUpdateNoteDuration(parseFloat(e.target.value))}
                    className="w-full max-w-[200px] bg-black/40 border border-white/10 text-stone-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer font-sans"
                  >
                    <option value="4.0">Whole Note (4 beats)</option>
                    <option value="3.0">Dotted Half (3 beats)</option>
                    <option value="2.0">Half Note (2 beats)</option>
                    <option value="1.5">Dotted Quarter (1.5 beats)</option>
                    <option value="1.0">Quarter Note (1 beat)</option>
                    <option value="0.75">Dotted Eighth (0.75 beats)</option>
                    <option value="0.5">Eighth Note (0.5 beats)</option>
                    <option value="0.25">Sixteenth Note (0.25 beats)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tip/Info footer */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-[11px] text-stone-400">
              <HelpCircle size={12} className="text-indigo-400" />
              <span>
                Tip: Changes here will automatically update the raw ABC text on the left, sync the player, and re-draw the solfas.
              </span>
            </div>
          </div>
        )}
        
        {/* Paper Sheet Container */}
        <div
          className="mx-auto max-w-4xl bg-[#FDFCF8] text-black border border-black/5 shadow-2xl rounded-2xl p-10 font-sans relative transition-all overflow-hidden"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginBottom: `${(scale - 1) * 100}%` // compensate for scale transforms
          }}
        >
          {/* Subtle Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none z-0">
            <h1 className="text-[14rem] md:text-[20rem] font-black tracking-tighter">SOLFA</h1>
          </div>

          <div className="relative z-10">
            {/* Piece Headers */}
            <div className="mb-12 border-b-2 border-black/10 pb-4 flex justify-between items-end">
              <div>
                <h1 className="font-serif italic font-medium text-3xl tracking-tight text-black">
                  {score.title}
                </h1>
                {score.composer && (
                  <p className="font-serif italic text-black/60 text-sm mt-1">
                    Composer: {score.composer}
                  </p>
                )}
              </div>
              <div className="text-right uppercase tracking-widest font-bold text-[10px] text-black/40">
                <p>Key: {score.key}</p>
                <p>Meter: {score.meter}</p>
              </div>
            </div>

            {/* Voice Mute / Solo Practice Panel */}
            <div className="mb-8 p-4 bg-black/5 border border-black/5 rounded-xl flex flex-wrap items-center gap-3 text-xs text-black/60">
              <span className="font-bold uppercase tracking-wider text-[10px] mr-2 text-black/50">Practice Tracks:</span>
              {score.voices.map((v) => {
                const active = !mutedVoices[v.id];
                return (
                  <button
                    key={`practice-voice-${v.id}`}
                    onClick={() => toggleMute(v.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? 'bg-indigo-600 border border-indigo-700 text-white shadow-sm'
                        : 'bg-black/5 border border-black/10 text-black/40'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        active ? 'bg-white' : 'bg-black/30'
                      }`}
                    />
                    {v.name}
                  </button>
                );
              })}
            </div>

            {/* Systems Loop */}
            <div className="flex flex-col gap-12 select-none">
              {score.systems.map((system) => {
                const refVoice = score.voices[0].id;
                const systemMeasuresCount = system.voices[refVoice]?.measures.length || 0;

                // Compute the exact height of the voice rows in this system for barline alignment
                const rowHeight = fontSize * 2.2;
                const systemHeight = score.voices.length * rowHeight;

                return (
                  <div
                    key={`system-${system.systemIndex}`}
                    className="flex flex-col border-b border-dashed border-black/10 pb-8 last:border-b-0"
                  >
                    {/* System Header with Index */}
                    <div className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-2 font-bold">
                      System {system.systemIndex + 1}
                    </div>

                    {/* Main Alignment Block with Autoscale wrapping both labels and measures */}
                    <div className="flex items-start w-full">
                      <AutoscalingMeasures systemHeight={systemHeight}>
                        {/* Bracing & Voice Labels block */}
                        <div className="w-20 flex-shrink-0 relative mr-6" style={{ height: `${systemHeight}px` }}>
                          {/* Visual braces */}
                          {score.voicePairingGroups.map((group, gIdx) =>
                            renderBrackets(system, group, gIdx)
                          )}

                          {/* Voice labels stacked vertically */}
                          <div className="flex flex-col h-full justify-around pr-2 text-right">
                            {score.voices.map((voice) => {
                              const isMuted = !!mutedVoices[voice.id];
                              return (
                                <div
                                  key={`label-${system.systemIndex}-${voice.id}`}
                                  className="font-serif italic font-bold transition-opacity duration-200 text-black/80"
                                  style={{
                                    fontSize: `${fontSize * 0.85}px`,
                                    height: `${rowHeight}px`,
                                    lineHeight: `${rowHeight}px`,
                                    opacity: isMuted ? 0.25 : 1.0
                                  }}
                                >
                                  {voice.name}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Measures Block */}
                        {Array.from({ length: systemMeasuresCount }).map((_, mIndex) => {
                          const isPlaying =
                            activeMeasure &&
                            activeMeasure.systemIndex === system.systemIndex &&
                            activeMeasure.measureIndex === mIndex;

                          const barType = system.voices[refVoice]?.barTypes[mIndex] || '|';

                          return (
                            <div
                              key={`measure-${system.systemIndex}-${mIndex}`}
                              className={`flex items-stretch transition-all duration-250 rounded-lg border ${
                                isPlaying
                                  ? 'bg-indigo-50/70 border-indigo-200 ring-4 ring-indigo-500/10 scale-[1.01] shadow-md'
                                  : 'border-transparent'
                              }`}
                            >
                              {/* Measure Content (Beat cells vertical stack) */}
                              <div className="flex flex-col justify-around px-2" style={{ height: `${systemHeight}px` }}>
                                {score.voices.map((voice) => {
                                  const voiceLine = system.voices[voice.id];
                                  const measure = voiceLine?.measures[mIndex];
                                  const isMuted = !!mutedVoices[voice.id];

                                  return (
                                    <div
                                      key={`notes-${system.systemIndex}-${mIndex}-${voice.id}`}
                                      className="font-serif font-black text-center whitespace-nowrap px-4 transition-all duration-200"
                                      style={{
                                        fontSize: `${fontSize}px`,
                                        height: `${rowHeight}px`,
                                        lineHeight: `${rowHeight}px`,
                                        opacity: isMuted ? 0.15 : 1.0
                                      }}
                                    >
                                      {measure ? (
                                        <InteractiveRhythmLine
                                          measure={measure}
                                          meterDenominator={meterDen}
                                          systemIndex={system.systemIndex}
                                          voiceId={voice.id}
                                          measureIndex={mIndex}
                                          selectedNote={selectedNote}
                                          onSelectNote={onSelectNote}
                                          isPlaying={isPlaying}
                                          isMuted={isMuted}
                                          isEditorMode={isEditorMode}
                                        />
                                      ) : (
                                        '\u00A0'
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Barline Column */}
                              <BarlineGraphic type={barType} height={systemHeight} />
                            </div>
                          );
                        })}
                      </AutoscalingMeasures>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Symbol Legend Box */}
            <div className="mt-16 pt-8 border-t border-black/10">
              <h3 className="text-center font-serif italic text-black/70 text-sm mb-4">
                Tonic Sol-fa Reference Legend
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-black/5 p-5 rounded-xl border border-black/5 text-[11px] text-black/60 font-sans">
                <div>
                  <span className="font-mono font-bold text-black">d r m f s l t</span>
                  <p className="mt-1">Movable-Do scale degrees. Tonic = d.</p>
                </div>
                <div>
                  <span className="font-mono font-bold text-black">di ri fi si li</span>
                  <p className="mt-1">Raised passing chromatic degrees.</p>
                </div>
                <div>
                  <span className="font-mono font-bold text-black">ḋ (d&#x307;) / ḍ (d&#x323;)</span>
                  <p className="mt-1">Octave marks: dot above = high, dot below = low.</p>
                </div>
                <div>
                  <span className="font-mono font-bold text-black">:  ·  -  |  ‖</span>
                  <p className="mt-1">
                    : divides beats. · rest. - held beat. | bar. ‖ section end.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
