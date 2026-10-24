/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ParsedScore } from '../types';
import {
  FlatPianoRollNote,
  flattenScoreToPianoRoll,
  formatAndReconstructScore,
  enforceMonophony,
  getVoiceTheme,
  formatPitchLabel,
  getMeterTicksPerMeasure,
  midiToNoteProperties,
} from '../engine/piano_roll_adapter';
import { MidiPlayer } from '../audio/midi_player';
import {
  Sparkles,
  Music,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Trash2,
  Check,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  X,
  HelpCircle,
  Eye,
  CheckSquare,
  Square,
  Volume2,
} from 'lucide-react';

interface PianoRollProps {
  score: ParsedScore;
  onUpdateScore: (newScore: ParsedScore) => void;
  currentTick?: number;
  playerRef?: React.RefObject<MidiPlayer | null>;
  onSeekTick?: (tick: number) => void;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// Pitch range: C2 (MIDI 36) to C6 (MIDI 84) = 49 chromatic keys
const MIN_MIDI = 36;
const MAX_MIDI = 84;
const KEY_COUNT = MAX_MIDI - MIN_MIDI + 1; // 49 keys

// Black key pitch classes (0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B)
const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

export const PianoRoll: React.FC<PianoRollProps> = ({
  score,
  onUpdateScore,
  currentTick = 0,
  playerRef,
  onSeekTick,
  onClose,
  isExpanded = false,
  onToggleExpand,
}) => {
  // 1. Grid & Display Settings
  const [pixelsPerTick, setPixelsPerTick] = useState<number>(4.0); // 16 ticks = 64px
  const [rowHeight, setRowHeight] = useState<number>(20); // 20px default row height
  const [snapTicks, setSnapTicks] = useState<number>(8); // default 8 ticks = 1/8 note
  const [autoFormatOnBlur, setAutoFormatOnBlur] = useState<boolean>(true);
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState<boolean>(false);

  // 2. Collapsible UI Panels (Clean scanability, collapse away by default)
  const [showToolsDrawer, setShowToolsDrawer] = useState<boolean>(false);
  const [showHelpDrawer, setShowHelpDrawer] = useState<boolean>(false);

  // 3. Local editable notes state
  const [notes, setNotes] = useState<FlatPianoRollNote[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  // 4. Active insertion voice channel (isolated single-channel insertion)
  const availableVoices = useMemo(() => {
    if (score.voices && score.voices.length > 0) {
      return score.voices.map((v) => v.id);
    }
    return ['S', 'A', 'T', 'B'];
  }, [score.voices]);

  const [activeVoiceId, setActiveVoiceId] = useState<string>(availableVoices[0] || 'S');

  // Keep active voice valid if score changes
  useEffect(() => {
    if (availableVoices.length > 0 && !availableVoices.includes(activeVoiceId)) {
      setActiveVoiceId(availableVoices[0]);
    }
  }, [availableVoices, activeVoiceId]);

  // Synchronize local notes from score when score updates from outside
  useEffect(() => {
    const { notes: flatNotes } = flattenScoreToPianoRoll(score);
    setNotes(flatNotes);
    setHasUncommittedChanges(false);
  }, [score]);

  // Containers and refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const pianoRollWrapperRef = useRef<HTMLDivElement>(null);

  // Dragging and Marquee Selection States
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState<boolean>(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);

  // Note Moving/Dragging state
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [dragOrigin, setDragOrigin] = useState<{
    startX: number;
    startY: number;
    noteTicks: { [id: string]: number };
    notePitches: { [id: string]: number };
  } | null>(null);
  const [hasMovedDuringDrag, setHasMovedDuringDrag] = useState<boolean>(false);

  // Meter calculations
  const meterTicks = useMemo(() => getMeterTicksPerMeasure(score.meter), [score.meter]);
  const totalTicks = useMemo(() => {
    let maxT = 0;
    notes.forEach((n) => {
      const end = n.startTick + n.durationTicks;
      if (end > maxT) maxT = end;
    });
    return Math.max(maxT + meterTicks * 2, meterTicks * 8);
  }, [notes, meterTicks]);

  const totalGridWidth = totalTicks * pixelsPerTick;
  const totalGridHeight = KEY_COUNT * rowHeight;
  const totalCanvasHeight = totalGridHeight + 28; // 28px timeline header

  // Sound preview helper
  const playPreview = useCallback(
    (midiPitch: number, durationSec: number = 0.3) => {
      if (playerRef?.current) {
        playerRef.current.previewNote(midiPitch, durationSec);
      }
    },
    [playerRef]
  );

  // Center vertical scroll to middle vocal range (e.g. C4 = 60) on initial render
  useEffect(() => {
    if (scrollContainerRef.current) {
      const c4Y = (MAX_MIDI - 60) * rowHeight;
      const targetScroll = Math.max(0, c4Y - scrollContainerRef.current.clientHeight / 2 + 60);
      scrollContainerRef.current.scrollTop = targetScroll;
    }
  }, [rowHeight]);

  // -------------------------------------------------------------
  // Auto-Format on Blur Handler
  // -------------------------------------------------------------
  const executeAutoFormat = useCallback(() => {
    if (notes.length === 0) return;
    try {
      const formattedScore = formatAndReconstructScore(score, notes, snapTicks);
      onUpdateScore(formattedScore);
      setHasUncommittedChanges(false);
    } catch (e) {
      console.error('Error auto-formatting piano roll score:', e);
    }
  }, [score, notes, snapTicks, onUpdateScore]);

  const handleBlur = (e: React.FocusEvent) => {
    // If the next focused element is still inside the piano roll wrapper, do not trigger blur
    if (pianoRollWrapperRef.current && pianoRollWrapperRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    if (autoFormatOnBlur && hasUncommittedChanges) {
      executeAutoFormat();
    }
  };

  // -------------------------------------------------------------
  // Coordinate helpers: convert mouse events to tick & pitch
  // -------------------------------------------------------------
  const getGridCoordinates = (e: React.MouseEvent) => {
    if (!gridContainerRef.current) return { tick: 0, pitch: 60 };
    const rect = gridContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rawTick = Math.max(0, x / pixelsPerTick);
    const snappedTick = Math.floor(rawTick / snapTicks) * snapTicks;

    const rowIdx = Math.floor(y / rowHeight);
    const clampedRow = Math.max(0, Math.min(KEY_COUNT - 1, rowIdx));
    const pitch = MAX_MIDI - clampedRow;

    return { tick: snappedTick, pitch, rawX: x, rawY: y };
  };

  // -------------------------------------------------------------
  // Note Insertion (Active Channel Only, Enforces Monophony)
  // -------------------------------------------------------------
  const handleGridDoubleClick = (e: React.MouseEvent) => {
    const { tick, pitch } = getGridCoordinates(e);

    // Create new note in active channel with duration = 1 beat (16 ticks) or snapTicks * 2
    const duration = Math.max(snapTicks * 2, 16);
    const noteProps = midiToNoteProperties(pitch, score.key);

    const newNote: FlatPianoRollNote = {
      id: `${activeVoiceId}_${Date.now()}_${Math.random()}`,
      voiceId: activeVoiceId,
      startTick: tick,
      durationTicks: duration,
      midiPitch: pitch,
      isRest: false,
      syllable: 'd',
      rawLetter: noteProps.rawLetter,
      rawAccidental: noteProps.rawAccidental,
      octaveNum: noteProps.octaveNum,
    };

    // Strictly enforce monophony in the active channel!
    const updatedNotes = enforceMonophony([...notes, newNote], activeVoiceId);
    setNotes(updatedNotes);
    setSelectedNoteIds(new Set([newNote.id]));
    setHasUncommittedChanges(true);

    playPreview(pitch);
  };

  // -------------------------------------------------------------
  // Note Selection and Multi-Channel Drag-Move
  // -------------------------------------------------------------
  const handleNoteMouseDown = (e: React.MouseEvent, note: FlatPianoRollNote) => {
    e.stopPropagation();

    playPreview(note.midiPitch);

    let nextSelection = new Set(selectedNoteIds);

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Toggle selection across any channel
      if (nextSelection.has(note.id)) {
        nextSelection.delete(note.id);
      } else {
        nextSelection.add(note.id);
      }
    } else {
      // If clicking a note not in current multi-selection, make it the sole selection
      if (!selectedNoteIds.has(note.id)) {
        nextSelection = new Set([note.id]);
      }
    }

    setSelectedNoteIds(nextSelection);
    setDraggingNoteId(note.id);
    setHasMovedDuringDrag(false);

    // Capture initial ticks & pitches for all selected notes
    const noteTicks: { [id: string]: number } = {};
    const notePitches: { [id: string]: number } = {};
    notes.forEach((n) => {
      if (nextSelection.has(n.id)) {
        noteTicks[n.id] = n.startTick;
        notePitches[n.id] = n.midiPitch;
      }
    });

    setDragOrigin({
      startX: e.clientX,
      startY: e.clientY,
      noteTicks,
      notePitches,
    });
  };

  // -------------------------------------------------------------
  // Grid Mouse Down: Marquee selection or unselect
  // -------------------------------------------------------------
  const handleGridMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only

    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      setSelectedNoteIds(new Set());
    }

    if (gridContainerRef.current) {
      const rect = gridContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setIsMarqueeSelecting(true);
      setMarqueeStart({ x, y });
      setMarqueeCurrent({ x, y });
    }
  };

  // -------------------------------------------------------------
  // Window / Grid Mouse Move: Note Dragging or Marquee Dragging
  // -------------------------------------------------------------
  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Note Dragging
    if (draggingNoteId && dragOrigin) {
      setHasMovedDuringDrag(true);
      const deltaX = e.clientX - dragOrigin.startX;
      const deltaY = e.clientY - dragOrigin.startY;

      const deltaTicksRaw = deltaX / pixelsPerTick;
      const deltaTicks = Math.round(deltaTicksRaw / snapTicks) * snapTicks;
      const deltaPitch = -Math.round(deltaY / rowHeight);

      setNotes((prevNotes) =>
        prevNotes.map((n) => {
          if (!selectedNoteIds.has(n.id)) return n;

          const origStart = dragOrigin.noteTicks[n.id] ?? n.startTick;
          const origPitch = dragOrigin.notePitches[n.id] ?? n.midiPitch;

          const newStart = Math.max(0, origStart + deltaTicks);
          const newPitch = Math.max(MIN_MIDI, Math.min(MAX_MIDI, origPitch + deltaPitch));

          return {
            ...n,
            startTick: newStart,
            midiPitch: newPitch,
          };
        })
      );
      setHasUncommittedChanges(true);
      return;
    }

    // 2. Marquee Selection Dragging
    if (isMarqueeSelecting && marqueeStart && gridContainerRef.current) {
      const rect = gridContainerRef.current.getBoundingClientRect();
      const x = Math.max(0, e.clientX - rect.left);
      const y = Math.max(0, e.clientY - rect.top);
      setMarqueeCurrent({ x, y });

      // Calculate marquee box
      const minX = Math.min(marqueeStart.x, x);
      const maxX = Math.max(marqueeStart.x, x);
      const minY = Math.min(marqueeStart.y, y);
      const maxY = Math.max(marqueeStart.y, y);

      // Highlight any note whose box intersects marquee
      const enclosedIds = new Set<string>(
        e.shiftKey || e.ctrlKey || e.metaKey ? selectedNoteIds : []
      );

      notes.forEach((n) => {
        const noteX = n.startTick * pixelsPerTick;
        const noteW = Math.max(12, n.durationTicks * pixelsPerTick);
        const noteY = (MAX_MIDI - n.midiPitch) * rowHeight;
        const noteH = rowHeight;

        // Check AABB intersection
        const intersects =
          noteX < maxX && noteX + noteW > minX && noteY < maxY && noteY + noteH > minY;

        if (intersects) {
          enclosedIds.add(n.id);
        }
      });

      setSelectedNoteIds(enclosedIds);
    }
  };

  // -------------------------------------------------------------
  // Mouse Up: Commit note move and enforce monophony
  // -------------------------------------------------------------
  const handleMouseUp = () => {
    if (draggingNoteId) {
      if (hasMovedDuringDrag) {
        // Enforce monophony for all channels that contain moved notes!
        const affectedVoiceIds = new Set<string>();
        notes.forEach((n) => {
          if (selectedNoteIds.has(n.id)) {
            affectedVoiceIds.add(n.voiceId);
          }
        });

        let updated = notes;
        affectedVoiceIds.forEach((vId) => {
          updated = enforceMonophony(updated, vId);
        });

        setNotes(updated);
        setHasUncommittedChanges(true);
      }
      setDraggingNoteId(null);
      setDragOrigin(null);
    }

    if (isMarqueeSelecting) {
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeCurrent(null);
    }
  };

  // -------------------------------------------------------------
  // Keyboard Shortcuts (Delete, Transpose with Arrows)
  // -------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close open drawers on Escape
      if (e.key === 'Escape') {
        if (showToolsDrawer) setShowToolsDrawer(false);
        if (showHelpDrawer) setShowHelpDrawer(false);
        if (selectedNoteIds.size > 0) {
          setSelectedNoteIds(new Set());
          return;
        }
      }

      if (selectedNoteIds.size === 0) return;

      // Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setNotes((prev) => prev.filter((n) => !selectedNoteIds.has(n.id)));
        setSelectedNoteIds(new Set());
        setHasUncommittedChanges(true);
        return;
      }

      // Transpose Up/Down
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const delta = e.key === 'ArrowUp' ? 1 : -1;
        setNotes((prev) =>
          prev.map((n) => {
            if (!selectedNoteIds.has(n.id)) return n;
            const newPitch = Math.max(MIN_MIDI, Math.min(MAX_MIDI, n.midiPitch + delta));
            return { ...n, midiPitch: newPitch };
          })
        );
        // Sound preview of transposed pitch
        const sampleNote = notes.find((n) => selectedNoteIds.has(n.id));
        if (sampleNote) {
          playPreview(sampleNote.midiPitch + delta);
        }
        setHasUncommittedChanges(true);
        return;
      }

      // Nudge Left/Right
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? snapTicks : -snapTicks;
        setNotes((prev) => {
          const shifted = prev.map((n) => {
            if (!selectedNoteIds.has(n.id)) return n;
            const newStart = Math.max(0, n.startTick + delta);
            return { ...n, startTick: newStart };
          });

          // Enforce monophony for affected channels
          const affectedVoices = new Set<string>();
          shifted.forEach((n) => {
            if (selectedNoteIds.has(n.id)) affectedVoices.add(n.voiceId);
          });
          let result = shifted;
          affectedVoices.forEach((vId) => {
            result = enforceMonophony(result, vId);
          });
          return result;
        });
        setHasUncommittedChanges(true);
        return;
      }

      // Select All (Ctrl+A / Cmd+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedNoteIds(new Set(notes.map((n) => n.id)));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteIds, notes, snapTicks, playPreview, showToolsDrawer, showHelpDrawer]);

  // Seek timeline click
  const handleRulerClick = (e: React.MouseEvent) => {
    if (!gridContainerRef.current) return;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedTick = Math.max(0, Math.round(x / pixelsPerTick));
    if (onSeekTick) {
      onSeekTick(clickedTick);
    }
  };

  // Generate Measure Barlines for the Timeline Header
  const measureColumns = useMemo(() => {
    const cols = [];
    const numMeasures = Math.ceil(totalTicks / meterTicks);
    for (let m = 0; m < numMeasures; m++) {
      cols.push({
        measureNumber: m + 1,
        startTick: m * meterTicks,
        width: meterTicks * pixelsPerTick,
      });
    }
    return cols;
  }, [totalTicks, meterTicks, pixelsPerTick]);

  // Active voice theme
  const activeVoiceTheme = getVoiceTheme(activeVoiceId);

  // Statistics for active vs other channels
  const activeChannelNoteCount = useMemo(
    () => notes.filter((n) => n.voiceId === activeVoiceId && !n.isRest).length,
    [notes, activeVoiceId]
  );

  return (
    <div
      ref={pianoRollWrapperRef}
      tabIndex={0}
      onBlur={handleBlur}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      className="flex flex-col h-full bg-[#0D0E12] text-stone-200 select-none overflow-hidden outline-none"
    >
      {/* 1. Piano Roll Clean Header Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#14161D] border-b border-white/10 text-xs shadow-md shrink-0">
        {/* Left: Title & Active Channel Insertion Selector */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <h3 className="font-sans font-black text-xs uppercase tracking-wider text-white hidden sm:flex items-center gap-1.5">
              <Music size={14} className="text-indigo-400" />
              Piano Roll
            </h3>
          </div>

          <div className="h-4 w-px bg-white/10 hidden sm:block shrink-0" />

          {/* Active Voice Channel Insertion Pill Selector */}
          <div className="flex items-center gap-1 bg-black/50 p-1 rounded-lg border border-white/10 overflow-x-auto max-w-[280px] sm:max-w-none">
            <span className="text-[10px] uppercase font-bold text-stone-400 px-1 hidden md:flex items-center gap-1 shrink-0">
              <Layers size={11} />
              Channel:
            </span>
            {availableVoices.map((vId) => {
              const theme = getVoiceTheme(vId);
              const isActive = activeVoiceId === vId;
              return (
                <button
                  key={vId}
                  type="button"
                  onClick={() => setActiveVoiceId(vId)}
                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? `${theme.bgClass} text-white shadow-md ring-1 ring-white/30`
                      : 'text-stone-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={`Insert notes into ${theme.name} channel (monophonic)`}
                >
                  <span
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: theme.hex }}
                  />
                  <span>{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Quick Controls & Collapsible Drawer Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Snap / Grid Size */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10 text-[11px]">
            <span className="text-stone-400 font-medium hidden sm:inline">Snap:</span>
            <select
              value={snapTicks}
              onChange={(e) => setSnapTicks(Number(e.target.value))}
              className="bg-transparent text-indigo-300 font-mono font-bold focus:outline-none cursor-pointer text-xs"
              title="Grid snap subdivision"
            >
              <option value={4} className="bg-stone-900 text-white">1/16</option>
              <option value={8} className="bg-stone-900 text-white">1/8</option>
              <option value={16} className="bg-stone-900 text-white">1/4</option>
              <option value={32} className="bg-stone-900 text-white">1/2</option>
            </select>
          </div>

          {/* Collapsible Options & Tools Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowToolsDrawer((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
              showToolsDrawer
                ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                : hasUncommittedChanges
                ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/20'
                : 'bg-black/40 border-white/10 text-stone-300 hover:text-white hover:bg-white/5'
            }`}
            title="Expand / collapse formatting tools, zoom, and selection controls"
          >
            <Sliders size={12} />
            <span className="hidden sm:inline">Tools & Format</span>
            {hasUncommittedChanges && !showToolsDrawer && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            )}
            {showToolsDrawer ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Quick Format Now Button (Directly reachable when unsaved) */}
          {hasUncommittedChanges && !showToolsDrawer && (
            <button
              onClick={executeAutoFormat}
              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg shadow cursor-pointer transition-all"
              title="Sync & auto-format changes now"
            >
              <Sparkles size={11} />
              <span className="hidden sm:inline">Format</span>
            </button>
          )}

          {/* Optional Expand / Fullscreen Toggle */}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 bg-black/40 hover:bg-white/10 text-stone-300 hover:text-white rounded-lg border border-white/10 cursor-pointer transition-colors"
              title={isExpanded ? 'Collapse to standard view' : 'Expand full canvas'}
            >
              {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}

          {/* Close Piano Roll view */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-black/40 hover:bg-white/10 text-stone-300 hover:text-white rounded-lg border border-white/10 cursor-pointer transition-colors"
              title="Close Piano Roll view"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Collapsible Tools & Format Drawer (Folds away cleanly) */}
      {showToolsDrawer && (
        <div className="bg-[#101218] border-b border-indigo-500/20 px-4 py-3 shadow-2xl transition-all duration-200 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* Group A: Format & Sync */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider">
                Sync & Quantization:
              </span>

              <label
                className="flex items-center gap-1.5 text-stone-300 hover:text-white cursor-pointer select-none bg-black/40 px-2.5 py-1 rounded-md border border-white/10"
                title="Automatically snap notes to grid and update Tonic Sol-fa when leaving the piano roll"
              >
                <input
                  type="checkbox"
                  checked={autoFormatOnBlur}
                  onChange={(e) => setAutoFormatOnBlur(e.target.checked)}
                  className="rounded border-stone-600 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] font-medium">Auto-format on blur</span>
              </label>

              <button
                onClick={executeAutoFormat}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-bold shadow-md cursor-pointer transition-all"
                title="Instantly format, quantize, and rebuild the score"
              >
                <Sparkles size={12} />
                <span>Format Now</span>
              </button>
            </div>

            {/* Group B: Zoom & Row Sizing */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider">
                Display:
              </span>

              {/* Horizontal Zoom */}
              <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-md border border-white/10 text-[11px]">
                <span className="text-stone-400 text-[10px] mr-1">Zoom:</span>
                <button
                  onClick={() => setPixelsPerTick((p) => Math.max(1.5, p * 0.8))}
                  className="p-0.5 hover:bg-white/10 rounded text-stone-300 hover:text-white cursor-pointer"
                  title="Zoom Out Horizontally"
                >
                  <ZoomOut size={12} />
                </button>
                <span className="text-[10px] font-mono text-stone-300 w-8 text-center font-bold">
                  {Math.round(pixelsPerTick * 25)}%
                </span>
                <button
                  onClick={() => setPixelsPerTick((p) => Math.min(10.0, p * 1.25))}
                  className="p-0.5 hover:bg-white/10 rounded text-stone-300 hover:text-white cursor-pointer"
                  title="Zoom In Horizontally"
                >
                  <ZoomIn size={12} />
                </button>
              </div>

              {/* Row Height Selector */}
              <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-md border border-white/10 text-[10px]">
                <button
                  onClick={() => setRowHeight(16)}
                  className={`px-2 py-0.5 rounded ${
                    rowHeight === 16 ? 'bg-indigo-600 text-white font-bold' : 'text-stone-400 hover:text-white'
                  }`}
                  title="Compact key rows (16px)"
                >
                  Compact
                </button>
                <button
                  onClick={() => setRowHeight(20)}
                  className={`px-2 py-0.5 rounded ${
                    rowHeight === 20 ? 'bg-indigo-600 text-white font-bold' : 'text-stone-400 hover:text-white'
                  }`}
                  title="Standard key rows (20px)"
                >
                  Standard
                </button>
                <button
                  onClick={() => setRowHeight(26)}
                  className={`px-2 py-0.5 rounded ${
                    rowHeight === 26 ? 'bg-indigo-600 text-white font-bold' : 'text-stone-400 hover:text-white'
                  }`}
                  title="Spacious key rows (26px)"
                >
                  Large
                </button>
              </div>
            </div>

            {/* Group C: Selection Tools */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedNoteIds(new Set(notes.map((n) => n.id)))}
                className="px-2 py-1 bg-black/40 hover:bg-white/10 text-stone-300 hover:text-white text-[10px] font-bold rounded border border-white/10 cursor-pointer"
                title="Select all notes across all channels (Ctrl+A)"
              >
                Select All
              </button>

              {selectedNoteIds.size > 0 && (
                <>
                  <button
                    onClick={() => setSelectedNoteIds(new Set())}
                    className="px-2 py-1 bg-black/40 hover:bg-white/10 text-stone-400 hover:text-white text-[10px] font-bold rounded border border-white/10 cursor-pointer"
                    title="Deselect all (Escape)"
                  >
                    Clear ({selectedNoteIds.size})
                  </button>

                  <button
                    onClick={() => {
                      setNotes((prev) => prev.filter((n) => !selectedNoteIds.has(n.id)));
                      setSelectedNoteIds(new Set());
                      setHasUncommittedChanges(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-red-600/30 hover:bg-red-600/40 text-red-200 border border-red-500/40 rounded text-[10px] font-bold cursor-pointer transition-colors"
                    title="Delete selected notes"
                  >
                    <Trash2 size={11} />
                    <span>Delete</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowToolsDrawer(false)}
                className="p-1 hover:bg-white/10 rounded text-stone-400 hover:text-white cursor-pointer ml-1"
                title="Fold away tools drawer"
              >
                <ChevronUp size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Work Area: Synchronized Keyboard & Full-Height Grid */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        <div
          ref={scrollContainerRef}
          className="flex-1 flex overflow-auto relative"
        >
          {/* Left Piano Keyboard Column (Sticky on horizontal scroll, fully sized) */}
          <div
            ref={keyboardRef}
            className="sticky left-0 z-20 flex-shrink-0 w-24 bg-[#111217] border-r border-white/15 select-none shadow-2xl"
            style={{
              paddingTop: '28px', // offset for the sticky 28px timeline header
              height: `${totalCanvasHeight}px`,
              minHeight: `${totalCanvasHeight}px`,
            }}
          >
            {Array.from({ length: KEY_COUNT }).map((_, i) => {
              const pitch = MAX_MIDI - i;
              const pc = ((pitch % 12) + 12) % 12;
              const isBlack = BLACK_KEY_PCS.has(pc);
              const isC = pc === 0;
              const label = formatPitchLabel(pitch, score.key);

              return (
                <div
                  key={pitch}
                  onClick={() => playPreview(pitch)}
                  className={`flex items-center justify-between px-2 text-[10px] font-mono font-bold border-b transition-colors cursor-pointer flex-shrink-0 ${
                    isBlack
                      ? 'bg-[#181920] hover:bg-[#252835] text-stone-400 border-black/40'
                      : 'bg-[#F8F9FA] hover:bg-[#E2E8F0] text-stone-900 border-stone-300'
                  } ${isC ? 'ring-1 ring-indigo-500/60 font-black' : ''}`}
                  style={{
                    height: `${rowHeight}px`,
                    minHeight: `${rowHeight}px`,
                  }}
                  title={`Play ${label} (MIDI ${pitch})`}
                >
                  <span className={`${isC ? 'text-indigo-600 font-extrabold' : ''}`}>
                    {label}
                  </span>
                  {isC && (
                    <span className="text-[8px] bg-indigo-600 text-white px-1 rounded-sm">
                      Do
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Timeline Header & Note Matrix Grid (Ensures full totalGridHeight without flex collapse!) */}
          <div
            className="flex-shrink-0 flex flex-col relative"
            style={{
              width: `${totalGridWidth}px`,
              minWidth: `${totalGridWidth}px`,
              height: `${totalCanvasHeight}px`,
              minHeight: `${totalCanvasHeight}px`,
            }}
          >
            {/* Timeline Ruler Header (Sticky on Vertical Scroll) */}
            <div
              onClick={handleRulerClick}
              className="sticky top-0 z-10 h-7 bg-[#161822] border-b border-white/15 flex flex-row cursor-pointer flex-shrink-0 shadow-sm"
              style={{
                width: `${totalGridWidth}px`,
                minWidth: `${totalGridWidth}px`,
                height: '28px',
              }}
              title="Click anywhere on the ruler to jump playback position"
            >
              {measureColumns.map((col) => (
                <div
                  key={col.measureNumber}
                  className="flex items-center px-2 text-[10px] font-mono font-bold text-stone-400 border-r border-white/20 select-none hover:bg-white/5 transition-colors shrink-0"
                  style={{ width: `${col.width}px` }}
                >
                  <span className="text-indigo-300">M{col.measureNumber}</span>
                  <span className="text-stone-600 text-[9px] ml-2">
                    {col.startTick}t
                  </span>
                </div>
              ))}
            </div>

            {/* Note Grid Canvas - Guaranteed to render all 49 semitone rows completely */}
            <div
              ref={gridContainerRef}
              onMouseDown={handleGridMouseDown}
              onDoubleClick={handleGridDoubleClick}
              className="relative flex-shrink-0 cursor-crosshair overflow-hidden"
              style={{
                width: `${totalGridWidth}px`,
                minWidth: `${totalGridWidth}px`,
                height: `${totalGridHeight}px`,
                minHeight: `${totalGridHeight}px`,
                backgroundSize: `${16 * pixelsPerTick}px ${rowHeight}px`,
              }}
            >
              {/* Horizontal Row Striping (Black vs White keys, all 49 rows rendered!) */}
              {Array.from({ length: KEY_COUNT }).map((_, i) => {
                const pitch = MAX_MIDI - i;
                const pc = ((pitch % 12) + 12) % 12;
                const isBlack = BLACK_KEY_PCS.has(pc);
                const isC = pc === 0;

                return (
                  <div
                    key={`row-${pitch}`}
                    className={`absolute w-full border-b ${
                      isBlack
                        ? 'bg-black/40 border-white/5'
                        : isC
                        ? 'bg-indigo-950/20 border-indigo-500/20'
                        : 'bg-white/[0.02] border-white/5'
                    }`}
                    style={{
                      top: `${i * rowHeight}px`,
                      height: `${rowHeight}px`,
                      minHeight: `${rowHeight}px`,
                    }}
                  />
                );
              })}

              {/* Vertical Measure & Beat Grid Lines across entire grid height */}
              {measureColumns.map((col) => (
                <div
                  key={`m-line-${col.measureNumber}`}
                  className="absolute top-0 bottom-0 border-r-2 border-indigo-500/30 pointer-events-none"
                  style={{
                    left: `${col.startTick * pixelsPerTick}px`,
                    height: `${totalGridHeight}px`,
                  }}
                />
              ))}

              {/* Playhead Marker */}
              {currentTick !== undefined && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                  style={{
                    left: `${currentTick * pixelsPerTick}px`,
                    height: `${totalGridHeight}px`,
                  }}
                >
                  <div className="w-2.5 h-2.5 bg-rose-500 transform -translate-x-[4px] -translate-y-1 rotate-45 shadow" />
                </div>
              )}

              {/* Rendered Interactive Note Blocks */}
              {notes.map((note) => {
                if (note.isRest) return null; // Piano roll notes only display sounding pitches

                const theme = getVoiceTheme(note.voiceId);
                const isSelected = selectedNoteIds.has(note.id);

                const left = note.startTick * pixelsPerTick;
                const width = Math.max(14, note.durationTicks * pixelsPerTick);
                const top = (MAX_MIDI - note.midiPitch) * rowHeight;
                const height = rowHeight - 2;

                return (
                  <div
                    key={note.id}
                    onMouseDown={(e) => handleNoteMouseDown(e, note)}
                    className={`absolute rounded-sm border cursor-move transition-shadow flex items-center justify-between px-1.5 overflow-hidden text-[10px] font-sans font-bold select-none ${
                      theme.bgClass
                    } ${
                      isSelected
                        ? 'ring-2 ring-white border-white shadow-2xl z-20'
                        : `${theme.borderClass} opacity-95 shadow-md z-10`
                    }`}
                    style={{
                      left: `${left}px`,
                      top: `${top + 1}px`,
                      width: `${width}px`,
                      height: `${height}px`,
                    }}
                    title={`${theme.name}: ${formatPitchLabel(note.midiPitch, score.key)} (${note.syllable}) • ${note.durationTicks}t`}
                  >
                    {/* Note Sol-fa Syllable */}
                    <span className="font-mono font-black text-white drop-shadow-sm truncate">
                      {note.syllable}
                    </span>

                    {/* Scientific Pitch (if note block is wide enough) */}
                    {width > 34 && (
                      <span className="text-[9px] font-mono text-white/85 drop-shadow-sm ml-1 truncate">
                        {formatPitchLabel(note.midiPitch, score.key)}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Drag Selection Marquee Overlay */}
              {isMarqueeSelecting && marqueeStart && marqueeCurrent && (
                <div
                  className="absolute bg-indigo-500/20 border border-indigo-400 rounded pointer-events-none z-30"
                  style={{
                    left: `${Math.min(marqueeStart.x, marqueeCurrent.x)}px`,
                    top: `${Math.min(marqueeStart.y, marqueeCurrent.y)}px`,
                    width: `${Math.abs(marqueeCurrent.x - marqueeStart.x)}px`,
                    height: `${Math.abs(marqueeCurrent.y - marqueeStart.y)}px`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Collapsible Help & Cheatsheet Panel (Folds away cleanly) */}
      {showHelpDrawer && (
        <div className="bg-[#12141C] border-t border-white/10 p-4 text-xs text-stone-300 shadow-inner shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-white flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <HelpCircle size={13} className="text-indigo-400" />
              Piano Roll Quick Guide & Monophony Standards
            </h4>
            <button
              onClick={() => setShowHelpDrawer(false)}
              className="text-stone-400 hover:text-white p-1 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] leading-relaxed">
            <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
              <span className="font-bold text-indigo-300 block mb-1">Inserting Notes</span>
              <p className="text-stone-400">
                Double-click on the grid to create a note in the active channel (<span className="text-white font-bold">{activeVoiceTheme.name}</span>). New notes conform strictly to vocal monophony.
              </p>
            </div>
            <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
              <span className="font-bold text-indigo-300 block mb-1">Multi-Channel Movement</span>
              <p className="text-stone-400">
                Drag a box to select notes from different voices at once. Drag horizontally to shift time or vertically to transpose pitches together.
              </p>
            </div>
            <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
              <span className="font-bold text-indigo-300 block mb-1">Auto-Format on Blur</span>
              <p className="text-stone-400">
                When you click away from the piano roll, notes automatically quantize to measure subdivisions, fill rest gaps, and update Tonic Sol-fa syllables.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. Minimalist Bottom Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#12131A] border-t border-white/10 text-[11px] text-stone-400 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeVoiceTheme.hex }} />
            <span className="text-stone-300 font-bold">{activeVoiceTheme.name} Channel</span>
            <span className="text-stone-500 text-[10px]">({activeChannelNoteCount} notes)</span>
          </div>

          {selectedNoteIds.size > 0 && (
            <span className="text-indigo-400 text-[10px] font-bold">
              • {selectedNoteIds.size} notes selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-stone-500 font-mono text-[10px] hidden sm:inline">
            Key: {score.key} | Meter: {score.meter}
          </span>

          <button
            type="button"
            onClick={() => setShowHelpDrawer((prev) => !prev)}
            className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
            title="Toggle Quick Guide & Keyboard Shortcuts"
          >
            <HelpCircle size={11} />
            <span>Shortcuts</span>
            {showHelpDrawer ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
        </div>
      </div>
    </div>
  );
};
