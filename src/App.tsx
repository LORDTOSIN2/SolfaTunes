/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ScoreRenderer } from './components/ScoreRenderer';
import { AbcParser } from './engine/abc_parser';
import { SolfaTransformer } from './engine/solfa_transformer';
import { ExampleSong, EXAMPLES } from './utils/examples';
import { ParsedScore, ParseWarning } from './types';
import { MidiPlayer } from './audio/midi_player';
import { MidiWriter } from './audio/midi_writer';
import { Play, Pause, Square, Music, Sliders, SlidersHorizontal, Download, Volume2 } from 'lucide-react';

export default function App() {
  // 1. App States
  const [abcText, setAbcText] = useState<string>(EXAMPLES[0].abcText);
  const [score, setScore] = useState<ParsedScore | null>(null);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  
  // Player control states
  const [bpm, setBpm] = useState<number>(100);
  const [transpose, setTranspose] = useState<number>(0);
  const [currentEighth, setCurrentEighth] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mutedVoices, setMutedVoices] = useState<{ [voiceId: string]: boolean }>({});

  // Sheet display states
  const [fontSize, setFontSize] = useState<number>(18);
  const [scale, setScale] = useState<number>(1.0);

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
      setCurrentEighth(0);
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

  // 4. Player Controls Event Handlers
  const handlePlay = () => {
    if (!score) return;
    
    setIsPlaying(true);
    playerRef.current?.play((tick) => {
      setCurrentEighth(tick);
      if (tick === 0) {
        setIsPlaying(false);
      }
    });
  };

  const handlePause = () => {
    setIsPlaying(false);
    playerRef.current?.pause();
  };

  const handleStop = () => {
    setIsPlaying(false);
    playerRef.current?.stop();
    setCurrentEighth(0);
  };

  const toggleMute = (voiceId: string) => {
    setMutedVoices(prev => ({
      ...prev,
      [voiceId]: !prev[voiceId]
    }));
  };

  const handleLoadExample = (song: ExampleSong) => {
    setAbcText(song.abcText);
  };

  const handleExportMidi = () => {
    if (!score) return;
    MidiWriter.downloadMidiFile(score, bpm, transpose);
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
    <div className="min-h-screen bg-[#0A0A0B] text-stone-200 flex flex-col antialiased font-sans">
      {/* Editorial Page Header */}
      <header className="px-8 py-5 border-b border-white/5 bg-[#0F1115] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg border border-indigo-500">
            <Music className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-sans font-black text-xl uppercase tracking-widest text-white flex items-center gap-2">
              SolfaTunes
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-bold mt-0.5">
              ABC Notation to Aligned Movable-Do Tonic Sol-fa Studio
            </p>
          </div>
        </div>

        {/* Dynamic Status Display */}
        <div className="flex items-center gap-4 text-[10px] font-mono uppercase font-bold tracking-wider text-stone-400 bg-black/40 border border-white/5 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-1.5">
            <Volume2 size={14} className="text-stone-500" />
            <span className="text-stone-500">Synthesizer:</span>
            <span className="text-[#10B981]">Ready</span>
          </div>
          {isPlaying && (
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-stone-500">Tick:</span>
              <span className="font-mono text-indigo-400">{Math.round(currentEighth)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Global Playback Control Toolbar */}
      <section className="bg-[#0F1115] px-8 py-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-6 shadow-md">
        {/* Playback Buttons */}
        <div className="flex items-center gap-2">
          {isPlaying ? (
            <button
              onClick={handlePause}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md font-sans font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer border border-indigo-500"
            >
              <Pause size={14} />
              Pause
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md font-sans font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer border border-indigo-500"
            >
              <Play size={14} fill="currentColor" />
              Play Score
            </button>
          )}

          <button
            onClick={handleStop}
            className="p-2.5 text-stone-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl active:scale-95 transition-all border border-white/10 cursor-pointer"
            title="Stop Playback"
          >
            <Square size={14} fill="currentColor" />
          </button>
        </div>

        {/* Sliders & Dropdowns */}
        <div className="flex flex-wrap items-center gap-6 flex-1 max-w-2xl justify-end">
          {/* Tempo BPM Slider */}
          <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-4 py-2 rounded-xl flex-1 min-w-[200px] max-w-[280px]">
            <SlidersHorizontal size={14} className="text-stone-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 mb-1">
                <span>Tempo (BPM)</span>
                <span className="text-indigo-400 font-bold">{bpm}</span>
              </div>
              <input
                type="range"
                min="40"
                max="220"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 h-1 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Transposition Dropdown */}
          <div className="flex items-center gap-2 bg-black/40 border border-white/5 px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
            <span className="text-stone-500 font-bold">
              Transpose:
            </span>
            <select
              value={transpose}
              onChange={(e) => setTranspose(parseInt(e.target.value, 10))}
              className="bg-stone-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {Array.from({ length: 13 }).map((_, i) => {
                const val = i - 6; // range -6 to +6
                return (
                  <option key={`transpose-opt-${val}`} value={val}>
                    {getTranspositionLabel(val)}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Export MIDI button */}
          <button
            onClick={handleExportMidi}
            className="px-4 py-2.5 bg-[#1C1E24] hover:bg-[#252830] border border-white/5 text-white rounded-xl active:scale-95 transition-all text-xs font-sans font-black uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Download size={14} />
            Export MIDI
          </button>
        </div>
      </section>

      {/* Main Work Area Dashboard */}
      <main className="flex-1 flex flex-col lg:flex-row p-6 lg:p-8 gap-6 lg:gap-8 overflow-hidden h-[calc(100vh-175px)]">
        {/* Editor panel on Left */}
        <Sidebar
          abcText={abcText}
          setAbcText={setAbcText}
          warnings={warnings}
          onLoadExample={handleLoadExample}
        />

        {/* Visualizer pane on Right */}
        <div className="flex-1 min-w-0 h-full">
          <ScoreRenderer
            score={score}
            currentEighth={currentEighth}
            fontSize={fontSize}
            setFontSize={setFontSize}
            scale={scale}
            setScale={setScale}
            mutedVoices={mutedVoices}
            toggleMute={toggleMute}
          />
        </div>
      </main>
    </div>
  );
}
