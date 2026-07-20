/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ExampleSong, EXAMPLES } from '../utils/examples';
import { ParseWarning } from '../types';
import { FileMusic, AlertTriangle, Upload, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface SidebarProps {
  abcText: string;
  setAbcText: (text: string) => void;
  warnings: ParseWarning[];
  onLoadExample: (example: ExampleSong) => void;
}

/**
 * Simple syntax highlighter for ABC notation.
 * Parses lines and returns React elements with styled spans.
 */
const highlightAbc = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    // 1. Comment check
    if (line.trimStart().startsWith('%')) {
      return (
        <span key={lineIdx} className="text-stone-500 italic">
          {line}
          {lineIdx < lines.length - 1 && '\n'}
        </span>
      );
    }

    // 2. Header check: starts with [A-Za-z]:
    const headerMatch = line.match(/^([A-Za-z]):(.*)$/);
    if (headerMatch) {
      const [_, field, content] = headerMatch;
      return (
        <span key={lineIdx}>
          <span className="text-[#818CF8] font-bold">{field}:</span>
          <span className="text-stone-300">{content}</span>
          {lineIdx < lines.length - 1 && '\n'}
        </span>
      );
    }

    // 3. Regular music lines: parse token by token
    const tokens: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < line.length) {
      const restLine = line.substring(i);

      // Inline voice specifier like [V:S] or [V:1] or any inline tag
      if (line[i] === '[' && restLine.startsWith('[V:')) {
        const closeIdx = line.indexOf(']', i);
        if (closeIdx !== -1) {
          const vSpec = line.substring(i, closeIdx + 1);
          tokens.push(
            <span key={key++} className="text-indigo-400 font-bold">
              {vSpec}
            </span>
          );
          i = closeIdx + 1;
          continue;
        }
      }

      // Bar lines: ||, |], [|, :|, |:, ::, |
      const barMatch = restLine.match(/^(?:\|\||\|\]|\[\||:\||\|:|::|\|)/);
      if (barMatch) {
        tokens.push(
          <span key={key++} className="text-amber-500 font-extrabold">
            {barMatch[0]}
          </span>
        );
        i += barMatch[0].length;
        continue;
      }

      // Accidentals: ^, _, = (and double sharps/flats ^^, __)
      const accMatch = restLine.match(/^(?:\^\^|__|\^|_|=)/);
      if (accMatch) {
        tokens.push(
          <span key={key++} className="text-emerald-400 font-bold">
            {accMatch[0]}
          </span>
        );
        i += accMatch[0].length;
        continue;
      }

      // Notes and octave indicators: [A-Ga-gzx] followed by possible octave marks or lengths
      const noteMatch = restLine.match(/^[A-Ga-gzx]/);
      if (noteMatch) {
        let noteLen = 1;
        // Collect octave marks
        while (i + noteLen < line.length && /[',]/.test(line[i + noteLen])) {
          noteLen++;
        }
        const fullNote = line.substring(i, i + noteLen);
        tokens.push(
          <span key={key++} className="text-stone-100 font-semibold">
            {fullNote}
          </span>
        );
        i += noteLen;
        continue;
      }

      // Durations/numbers: /2, 2, / etc.
      const durMatch = restLine.match(/^(?:\/[0-9]*|[0-9]+)/);
      if (durMatch) {
        tokens.push(
          <span key={key++} className="text-sky-400 font-medium">
            {durMatch[0]}
          </span>
        );
        i += durMatch[0].length;
        continue;
      }

      // Rhythms/Chords/Guitar chords: "C" or similar
      if (line[i] === '"') {
        const endQuote = line.indexOf('"', i + 1);
        if (endQuote !== -1) {
          tokens.push(
            <span key={key++} className="text-pink-400 italic font-semibold">
              {line.substring(i, endQuote + 1)}
            </span>
          );
          i = endQuote + 1;
          continue;
        }
      }

      // Any other characters (whitespace, punctuation, etc.)
      tokens.push(line[i]);
      i++;
    }

    return (
      <span key={lineIdx}>
        {tokens}
        {lineIdx < lines.length - 1 && '\n'}
      </span>
    );
  });
};

export const Sidebar: React.FC<SidebarProps> = ({
  abcText,
  setAbcText,
  warnings,
  onLoadExample
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // Sync scroll positions from textarea to highlight container
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Keep scroll synced when text changes (e.g. loading masterpieces)
  useEffect(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [abcText]);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      readAndSetFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      readAndSetFile(e.target.files[0]);
    }
  };

  const readAndSetFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        setAbcText(event.target.result);
      }
    };
    reader.readAsText(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full lg:w-[380px] bg-[#0F1115] border-r border-white/5 flex flex-col h-full shadow-xl">
      {/* Sidebar Header */}
      <div className="px-6 py-5 border-b border-white/5 bg-[#13161C]">
        <div className="flex items-center gap-2 text-white">
          <FileMusic className="text-[#4F46E5] h-5 w-5" />
          <h2 className="font-sans font-black text-sm uppercase tracking-wider">ABC Notation Editor</h2>
        </div>
        <p className="text-[11px] text-stone-400 mt-1">
          Compose or paste ABC code, or choose an example song below.
        </p>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
        {/* Example Selector */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#4F46E5] mb-2 font-sans">
            Load Masterpieces
          </label>
          <div className="grid grid-cols-1 gap-2">
            {EXAMPLES.map((eg) => (
              <button
                key={eg.id}
                onClick={() => onLoadExample(eg)}
                className="w-full text-left px-3.5 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-[#4F46E5]/50 text-stone-300 hover:text-white text-xs font-serif font-medium transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <span className="block font-semibold">{eg.title}</span>
                  <span className="block text-[10px] text-stone-400 italic font-sans">{eg.composer}</span>
                </div>
                <span className="text-[10px] bg-white/10 text-stone-300 px-2 py-0.5 rounded-full font-sans group-hover:bg-[#4F46E5] transition-colors">
                  Load
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Text Code Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#4F46E5] font-sans">
              ABC Source Code
            </label>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-stone-400 hover:text-white cursor-pointer flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <HelpCircle size={14} />
              {showHelp ? 'Hide Cheat Sheet' : 'Cheat Sheet'}
            </button>
          </div>

          {/* Quick Syntax Cheat Sheet */}
          {showHelp && (
            <div className="p-3.5 mb-3 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-lg text-[11px] text-indigo-200 font-sans leading-relaxed shadow-sm">
              <p className="font-bold text-white mb-1">ABC Notation Basics:</p>
              <ul className="list-disc list-inside space-y-1 text-indigo-100/80">
                <li><span className="font-bold font-mono text-white">T:</span> Title, <span className="font-bold font-mono text-white">C:</span> Composer.</li>
                <li><span className="font-bold font-mono text-white">K:</span> Key (e.g. <span className="font-mono">K:G</span>, <span className="font-mono">K:Am</span>).</li>
                <li><span className="font-bold font-mono text-white">M:</span> Meter (e.g. <span className="font-mono">M:4/4</span>).</li>
                <li><span className="font-bold font-mono text-white">V:S name="Soprano"</span> Declares voice.</li>
                <li>Pitches: uppercase <span className="font-mono font-semibold">C..B</span> (octave 4), lowercase <span className="font-mono font-semibold">c..b</span> (octave 5). Comma <span className="font-mono">,</span> lowers, apostrophe <span className="font-mono">'</span> raises.</li>
                <li>Accidentals: <span className="font-mono">^</span> sharp, <span className="font-mono">_</span> flat, <span className="font-mono">=</span> natural.</li>
              </ul>
            </div>
          )}

          {/* Highlighted Editor Wrapper */}
          <div className="flex-1 min-h-[220px] lg:min-h-0 relative border border-white/10 rounded-lg bg-[#0A0A0B] focus-within:ring-1 focus-within:ring-[#4F46E5] focus-within:border-[#4F46E5] shadow-inner overflow-hidden">
            {/* Background Highlighted Pre */}
            <pre
              ref={highlightRef}
              className="absolute inset-0 w-full h-full p-4 font-mono text-xs leading-relaxed text-indigo-100/30 whitespace-pre-wrap break-all overflow-hidden pointer-events-none select-none border border-transparent"
              aria-hidden="true"
            >
              {highlightAbc(abcText)}
            </pre>

            {/* Foreground Textarea */}
            <textarea
              ref={textareaRef}
              value={abcText}
              onChange={(e) => setAbcText(e.target.value)}
              onScroll={handleScroll}
              className="absolute inset-0 w-full h-full p-4 font-mono text-xs leading-relaxed bg-transparent text-transparent caret-white focus:outline-none resize-none whitespace-pre-wrap break-all overflow-auto border border-transparent"
              placeholder="Type or paste ABC notation here..."
              spellCheck="false"
            />
          </div>
        </div>

        {/* Drag and Drop File Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-lg p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 shadow-sm ${
            dragActive
              ? 'border-[#4F46E5] bg-[#4F46E5]/10 scale-[0.99]'
              : 'border-white/10 hover:border-[#4F46E5]/50 bg-white/[0.01] hover:bg-white/[0.03]'
          }`}
        >
          <Upload size={20} className={dragActive ? 'text-[#6366F1]' : 'text-stone-400'} />
          <div>
            <p className="text-xs font-semibold text-stone-200">
              {dragActive ? 'Drop your file here!' : 'Import .abc or .txt file'}
            </p>
            <p className="text-[10px] text-stone-500 mt-1">
              Drag & drop or click to upload from your computer
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".abc,.txt"
            className="hidden"
          />
        </div>

        {/* Collapsible Parser Warnings Banner */}
        {warnings.length > 0 && (
          <div className="border border-red-500/20 rounded-lg bg-red-500/10 overflow-hidden shadow-sm">
            <button
              onClick={() => setShowWarnings(!showWarnings)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-red-500/20 border-b border-red-500/10 text-red-200 text-xs font-semibold select-none cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                <span>Parser Warnings ({warnings.length})</span>
              </div>
              {showWarnings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showWarnings && (
              <div className="p-3 max-h-[140px] overflow-auto divide-y divide-red-500/10">
                {warnings.map((warn, wIdx) => (
                  <div key={`warning-${wIdx}`} className="py-1.5 text-[10px] text-red-200/80 font-sans">
                    <span className="font-bold text-red-400">
                      {warn.voiceId ? `Voice [${warn.voiceId}]: ` : ''}
                    </span>
                    {warn.reason}
                    {warn.rawText && (
                      <code className="block mt-0.5 bg-red-500/20 px-1 py-0.5 rounded text-red-300 text-[9px] font-mono w-fit">
                        Raw: "{warn.rawText}"
                      </code>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
