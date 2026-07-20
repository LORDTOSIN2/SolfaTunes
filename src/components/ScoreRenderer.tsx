/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ParsedScore, System, VoiceLine, Measure, SolfaNote } from '../types';
import { SolfaTransformer } from '../engine/solfa_transformer';
import { ZoomIn, ZoomOut, Type } from 'lucide-react';

interface ScoreRendererProps {
  score: ParsedScore | null;
  currentEighth: number;
  fontSize: number;
  setFontSize: (size: number) => void;
  scale: number;
  setScale: (scale: number) => void;
  mutedVoices: { [voiceId: string]: boolean };
  toggleMute: (voiceId: string) => void;
}

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
  toggleMute
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
        <div className="flex items-center gap-6">
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

                    {/* Main Alignment Block */}
                    <div className="flex items-start">
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
                      <AutoscalingMeasures systemHeight={systemHeight}>
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

                                  // Format rhythm
                                  const formattedRhythm = measure
                                    ? SolfaTransformer.formatMeasureRhythm(measure, meterDen)
                                    : '';

                                  return (
                                    <div
                                      key={`notes-${system.systemIndex}-${mIndex}-${voice.id}`}
                                      className="font-serif font-black tracking-widest text-center whitespace-nowrap px-4 transition-all duration-200"
                                      style={{
                                        fontSize: `${fontSize}px`,
                                        height: `${rowHeight}px`,
                                        lineHeight: `${rowHeight}px`,
                                        color: isMuted
                                          ? 'transparent'
                                          : isPlaying
                                          ? '#4F46E5'
                                          : '#000000',
                                        textDecoration: isPlaying ? 'underline' : 'none',
                                        textUnderlineOffset: '6px',
                                        opacity: isMuted ? 0.15 : 1.0
                                      }}
                                    >
                                      {formattedRhythm || '\u00A0'}
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
