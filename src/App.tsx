/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ScoreRenderer } from './components/ScoreRenderer';
import { AbcParser } from './engine/abc_parser';
import { SolfaTransformer } from './engine/solfa_transformer';
import { SCORES, ScoreLibraryItem } from './utils/scores';
import { ParsedScore, ParseWarning, SelectedNoteLocation } from './types';
import { MidiPlayer } from './audio/midi_player';
import { MidiWriter } from './audio/midi_writer';
import { serializeScoreToAbc } from './engine/abc_serializer';
import { Music, Download, FileDown } from 'lucide-react';
import { FloatingPlaybackDock } from './components/FloatingPlaybackDock';

export default function App() {
  // 1. App States
  const [abcText, setAbcText] = useState<string>(SCORES[0]?.abcText || '');
  const [score, setScore] = useState<ParsedScore | null>(null);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  
  // Player control states
  const [bpm, setBpm] = useState<number>(100);
  const [transpose, setTranspose] = useState<number>(0);
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mutedVoices, setMutedVoices] = useState<{ [voiceId: string]: boolean }>({});
  const [masterVolume, setMasterVolume] = useState<number>(0.8);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // Sheet display states
  const [fontSize, setFontSize] = useState<number>(18);
  const [scale, setScale] = useState<number>(1.0);

  // Selected note state for visual editing
  const [selectedNote, setSelectedNote] = useState<SelectedNoteLocation | null>(null);
  const [studioMode, setStudioMode] = useState<'read' | 'lyrics' | 'interactive' | 'source'>('interactive');
  const scoreContainerRef = useRef<HTMLDivElement | null>(null);

  // Compute total duration of score in sixteenth ticks
  const totalTicks = useMemo(() => {
    if (!score) return 0;
    let maxTick = 0;
    score.voices.forEach((v) => {
      score.systems.forEach((sys) => {
        const line = sys.voices[v.id];
        if (line) {
          line.measures.forEach((measure) => {
            measure.notes.forEach((note) => {
              const end = note.timestamp + note.durationTicks;
              if (end > maxTick) {
                maxTick = end;
              }
            });
          });
        }
      });
    });
    return maxTick;
  }, [score]);

  // 2. Playback Engine reference
  const playerRef = useRef<MidiPlayer | null>(null);

  // Ensure player instance is created once
  useEffect(() => {
    playerRef.current = new MidiPlayer();
    return () => {
      playerRef.current?.dispose();
    };
  }, []);

  // 3. Compile/Parse ABC text whenever it changes
  useEffect(() => {
    try {
      const parser = new AbcParser();
      const { score: rawScore, warnings: parseWarns } = parser.parse(abcText);
      
      const transformer = new SolfaTransformer();
      const resolvedScore = transformer.transform(rawScore);
      
      setScore(resolvedScore);
      setWarnings(parseWarns);

      // Reset playhead and stop current playbacks when score changes
      setIsPlaying(false);
      setCurrentTick(0);
      playerRef.current?.stop();
      
      // Load into the player
      playerRef.current?.loadScore(resolvedScore, bpm, mutedVoices);
    } catch (err: any) {
      console.error('Error parsing ABC Notation:', err);
      setWarnings([{
        rawText: '',
        reason: `Fatal parser error: ${err?.message || err}`
      }]);
    }
  }, [abcText]);

  // Sync BPM changes with player
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setBpm(bpm);
    }
  }, [bpm]);

  // Sync Transpose changes with player
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setTransposeOffset(transpose);
    }
  }, [transpose]);

  // Sync Muted voices changes with player
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.updateActiveVoices(mutedVoices);
    }
  }, [mutedVoices]);

  // Sync Master Volume with player
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setMasterVolume(masterVolume);
    }
  }, [masterVolume]);

  // Sync Looping with player
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setLooping(isLooping);
    }
  }, [isLooping]);

  // 4. Player Controls Event Handlers
  const handlePlay = () => {
    if (!score) return;
    
    setIsPlaying(true);
    playerRef.current?.play((tick) => {
      setCurrentTick(tick);
    }, () => setIsPlaying(false));
  };

  const handlePause = () => {
    setIsPlaying(false);
    playerRef.current?.pause();
  };

  const handleStop = () => {
    setIsPlaying(false);
    playerRef.current?.stop();
    setCurrentTick(0);
  };

  const handleSeek = (tick: number) => {
    playerRef.current?.seek(tick);
    setCurrentTick(tick);
  };

  const toggleLoop = () => {
    setIsLooping(prev => {
      const next = !prev;
      playerRef.current?.setLooping(next);
      return next;
    });
  };

  const toggleMute = (voiceId: string) => {
    setMutedVoices(prev => ({
      ...prev,
      [voiceId]: !prev[voiceId]
    }));
  };

  const handleLoadScore = (song: ScoreLibraryItem) => {
    setAbcText(song.abcText);
    setSelectedNote(null);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      scoreContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleUpdateScore = (newScore: ParsedScore) => {
    const newAbc = serializeScoreToAbc(newScore);
    setAbcText(newAbc);
  };

  const handleExportMidi = () => {
    if (!score) return;
    MidiWriter.downloadMidiFile(score, bpm, transpose);
  };

  const handleExportAbc = () => {
    if (!abcText) return;
    const blob = new Blob([abcText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileName = score?.title 
      ? `${score.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.abc` 
      : 'score.abc';
      
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Convert transpose values into helpful human-readable key steps
  const getTranspositionLabel = (val: number): string => {
    if (val === 0) return 'Original Key (C)';
    const prefix = val > 0 ? '+' : '';
    const semitones = `${prefix}${val} semitone${Math.abs(val) > 1 ? 's' : ''}`;
    
    // Add musical intervals for intuitive guidance
    switch (val) {
      case 1: return `${semitones} (m2nd Up)`;
      case 2: return `${semitones} (M2nd Up)`;
      case 3: return `${semitones} (m3rd Up)`;
      case 4: return `${semitones} (M3rd Up)`;
      case 5: return `${semitones} (P4th Up)`;
      case 6: return `${semitones} (Tritone Up)`;
      case -1: return `${semitones} (m2nd Down)`;
      case -2: return `${semitones} (M2nd Down)`;
      case -3: return `${semitones} (m3rd Down)`;
      case -4: return `${semitones} (M3rd Down)`;
      case -5: return `${semitones} (P4th Down)`;
      case -6: return `${semitones} (Tritone Down)`;
      default: return semitones;
    }
  };

  return (
    <div className="min-h-screen lg:h-screen overflow-x-clip bg-[#0A0A0B] text-stone-200 flex flex-col antialiased font-sans">
      {/* Editorial Page Header */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-5 border-b border-white/5 bg-[#0F1115] flex items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 sm:p-2.5 rounded-xl text-white shadow-lg border border-indigo-500">
            <Music className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-sans font-black text-lg sm:text-xl uppercase tracking-widest text-white flex items-center gap-2">
              SolfaTunes
            </h1>
            <p className="text-[9px] sm:text-[10px] font-mono tracking-wide text-stone-500 font-bold mt-0.5">
              ABC & Tonic Sol-fa music studio
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleExportAbc}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-stone-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            title="Download ABC notation"
            aria-label="Download ABC notation"
          >
            <FileDown size={16} />
            <span className="hidden sm:inline text-xs font-semibold">ABC</span>
          </button>
          <button
            onClick={handleExportMidi}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-indigo-500/60 bg-indigo-600 px-3 text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            title="Export MIDI"
            aria-label="Export MIDI"
          >
            <Download size={16} />
            <span className="hidden sm:inline text-xs font-semibold">MIDI</span>
          </button>
        </div>
      </header>

      {/* Main Work Area Dashboard */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row p-3 sm:p-5 lg:p-8 pb-36 lg:pb-8 gap-4 lg:gap-8 lg:overflow-hidden">
        {/* Editor panel on Left */}
        <div className="order-2 min-w-0 lg:order-1 lg:w-[380px] lg:shrink-0 lg:h-full lg:min-h-0">
          <Sidebar
            setAbcText={setAbcText}
            warnings={warnings}
            onLoadScore={handleLoadScore}
            selectedScoreId={SCORES.find(song => song.abcText === abcText)?.id}
          />
        </div>

        {/* Put the score first on phones so it is visible without scrolling past the library. */}
        <div ref={scoreContainerRef} className="order-1 min-w-0 h-[70vh] min-h-[32rem] scroll-mt-3 lg:order-2 lg:flex-1 lg:h-full lg:min-h-0">
          <ScoreRenderer
            score={score}
            abcText={abcText}
            setAbcText={setAbcText}
            warnings={warnings}
            currentTick={currentTick}
            currentEighth={currentTick}
            fontSize={fontSize}
            setFontSize={setFontSize}
            scale={scale}
            setScale={setScale}
            mutedVoices={mutedVoices}
            toggleMute={toggleMute}
            selectedNote={selectedNote}
            onSelectNote={setSelectedNote}
            onUpdateScore={handleUpdateScore}
            studioMode={studioMode}
            setStudioMode={setStudioMode}
          />
        </div>
      </main>

      {/* Unified Floating Playback Dock ("Always Within Reach") */}
      <FloatingPlaybackDock
        score={score}
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        currentTick={currentTick}
        totalTicks={totalTicks}
        bpm={bpm}
        setBpm={setBpm}
        transpose={transpose}
        setTranspose={setTranspose}
        masterVolume={masterVolume}
        setMasterVolume={setMasterVolume}
        onSeek={handleSeek}
        mutedVoices={mutedVoices}
        toggleMute={toggleMute}
        isLooping={isLooping}
        toggleLoop={toggleLoop}
        getTranspositionLabel={getTranspositionLabel}
      />
    </div>
  );
}
