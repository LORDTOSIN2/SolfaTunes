/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ScoreRenderer } from './components/ScoreRenderer';
import { AbcParser } from './engine/abc_parser';
import { SolfaTransformer } from './engine/solfa_transformer';
import { createAbcMusicalDocument, createMusicalDocument, MusicalDocument } from './engine/musical_document';
import {
  applyExplicitSolfaOverrides,
  exportMusicXmlDocument,
  importMusicXmlDocument,
} from './engine/musicxml/document_io';
import { formatLossinessReport } from './engine/musicxml/lossiness_report';
import { SCORES, ScoreLibraryItem } from './utils/scores';
import { ParsedScore, ParseWarning, SelectedNoteLocation } from './types';
import { MidiPlayer } from './audio/midi_player';
import { MidiWriter } from './audio/midi_writer';
import { serializeScoreToAbc } from './engine/abc_serializer';
import { Music, Download, FileDown, FileUp } from 'lucide-react';
import { FloatingPlaybackDock } from './components/FloatingPlaybackDock';

export default function App() {
  // 1. App States
  const [abcText, setAbcText] = useState<string>(SCORES[0]?.abcText || '');
  const [abcLoadVersion, setAbcLoadVersion] = useState(0);
  const [musicalDocument, setMusicalDocument] = useState<MusicalDocument | null>(null);
  const score = musicalDocument?.score ?? null;
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  const [musicXmlStatus, setMusicXmlStatus] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
  } | null>(null);
  
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
  const musicXmlInputRef = useRef<HTMLInputElement | null>(null);
  const musicXmlProvenanceRef = useRef<MusicalDocument | null>(null);
  const skipNextAbcParseRef = useRef(false);

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
    if (skipNextAbcParseRef.current) {
      skipNextAbcParseRef.current = false;
      return;
    }

    try {
      const parser = new AbcParser();
      const { score: rawScore, warnings: parseWarns } = parser.parse(abcText);
      
      const transformer = new SolfaTransformer();
      const resolvedScore = transformer.transform(rawScore);
      
      const importedDocument = musicXmlProvenanceRef.current;
      const nextDocument = importedDocument
        ? createMusicalDocument(resolvedScore, {
            metadata: importedDocument.metadata,
            conversionReport: importedDocument.conversionReport,
            source: importedDocument.source,
          })
        : createAbcMusicalDocument(resolvedScore, abcText);
      if (importedDocument) applyExplicitSolfaOverrides(nextDocument);
      setMusicalDocument(nextDocument);
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
  }, [abcText, abcLoadVersion]);

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
    musicXmlProvenanceRef.current = null;
    setMusicXmlStatus(null);
    setAbcText(song.abcText);
    setAbcLoadVersion(version => version + 1);
    setSelectedNote(null);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      scoreContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLoadAbcText = (text: string) => {
    musicXmlProvenanceRef.current = null;
    setMusicXmlStatus(null);
    setAbcText(text);
    setAbcLoadVersion(version => version + 1);
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

  const handleImportMusicXml = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    try {
      const xml = await file.text();
      const imported = importMusicXmlDocument(xml, (summary) => window.confirm(
        `This MusicXML import is partial or lossy. Continue and replace the current score?\n\n${summary}\n\nThe original MusicXML will be retained in the document for recovery.`
      ));
      if (!imported) {
        setMusicXmlStatus({
          type: 'info',
          message: 'MusicXML import cancelled. The current score was not changed.',
        });
        return;
      }

      musicXmlProvenanceRef.current = imported;
      const importedAbc = serializeScoreToAbc(imported.score);
      if (importedAbc !== abcText) {
        skipNextAbcParseRef.current = true;
        setAbcText(importedAbc);
      }
      setMusicalDocument(imported);
      setWarnings([]);
      setSelectedNote(null);
      setIsPlaying(false);
      setCurrentTick(0);
      playerRef.current?.stop();
      playerRef.current?.loadScore(imported.score, bpm, mutedVoices);
      setMusicXmlStatus({
        type: imported.conversionReport?.isLossless === false ? 'warning' : 'success',
        message: imported.conversionReport?.isLossless === false
          ? 'MusicXML imported with conversion warnings. The original file is retained for recovery.'
          : 'MusicXML imported. No conversion losses were reported.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setMusicXmlStatus({
        type: 'error',
        message: `MusicXML import failed. The current score was not changed. ${message}`,
      });
    }
  };

  const handleExportMusicXml = () => {
    if (!musicalDocument) return;

    try {
      const result = exportMusicXmlDocument(musicalDocument);
      if (!result.report.isLossless && !window.confirm(
        `This MusicXML export includes conversion losses or unsupported constructs.\n\n${formatLossinessReport(result.report)}\n\nThe original MusicXML source, when available, is embedded in the exported metadata as a recovery copy. Continue?`
      )) {
        setMusicXmlStatus({
          type: 'info',
          message: 'MusicXML export cancelled.',
        });
        return;
      }

      const blob = new Blob([result.xml], { type: 'application/vnd.recordare.musicxml+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      const fileName = score?.title
        ? `${score.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.musicxml`
        : 'score.musicxml';
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMusicXmlStatus({
        type: result.report.isLossless ? 'success' : 'warning',
        message: result.report.isLossless
          ? 'MusicXML export completed.'
          : 'MusicXML export completed with conversion warnings. The original source is embedded when available.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setMusicXmlStatus({
        type: 'error',
        message: `MusicXML export failed. ${message}`,
      });
    }
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
          <input
            ref={musicXmlInputRef}
            type="file"
            accept=".xml,.musicxml,application/xml,text/xml,application/vnd.recordare.musicxml+xml"
            onChange={handleImportMusicXml}
            className="hidden"
            aria-label="Import MusicXML file"
          />
          <button
            type="button"
            onClick={() => musicXmlInputRef.current?.click()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-stone-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            title="Import MusicXML"
            aria-label="Import MusicXML"
          >
            <FileUp size={16} />
            <span className="hidden sm:inline text-xs font-semibold">Import XML</span>
          </button>
          <button
            type="button"
            onClick={handleExportMusicXml}
            disabled={!musicalDocument}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-stone-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            title="Download MusicXML"
            aria-label="Download MusicXML"
          >
            <FileDown size={16} />
            <span className="hidden sm:inline text-xs font-semibold">MusicXML</span>
          </button>
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

      {musicXmlStatus && (
        <div
          role={musicXmlStatus.type === 'error' || musicXmlStatus.type === 'warning' ? 'alert' : 'status'}
          aria-live="polite"
          className={`border-b px-4 py-2 text-xs ${
            musicXmlStatus.type === 'error'
              ? 'border-red-400/20 bg-red-950/40 text-red-200'
              : musicXmlStatus.type === 'warning'
                ? 'border-amber-400/20 bg-amber-950/30 text-amber-200'
                : 'border-emerald-400/20 bg-emerald-950/20 text-emerald-200'
          }`}
        >
          {musicXmlStatus.message}
        </div>
      )}

      {/* Main Work Area Dashboard */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row p-3 sm:p-5 lg:p-8 pb-36 lg:pb-8 gap-4 lg:gap-8 lg:overflow-hidden">
        {/* Editor panel on Left */}
        <div className="order-2 min-w-0 lg:order-1 lg:w-[380px] lg:shrink-0 lg:h-full lg:min-h-0">
          <Sidebar
            onLoadAbcText={handleLoadAbcText}
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
