/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { ExampleSong, EXAMPLES } from '../utils/examples';
import { ParseWarning } from '../types';
import { FileMusic, AlertTriangle, Upload, ChevronDown, ChevronUp, Download } from 'lucide-react';

interface SidebarProps {
  abcText: string;
  setAbcText: (text: string) => void;
  warnings: ParseWarning[];
  onLoadExample: (example: ExampleSong) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  abcText,
  setAbcText,
  warnings,
  onLoadExample
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <h2 className="font-sans font-black text-sm uppercase tracking-wider">Workspace Studio</h2>
        </div>
        <p className="text-[11px] text-stone-400 mt-1">
          Select or load masterpiece settings, or import your own music files below.
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

        {/* Download ABC notation option */}
        <button
          onClick={() => {
            const blob = new Blob([abcText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            let fileName = 'score.abc';
            const titleMatch = abcText.match(/^T:\s*(.+)$/m);
            if (titleMatch && titleMatch[1]) {
              fileName = `${titleMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}.abc`;
            }
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }}
          className="w-full py-2.5 px-4 bg-[#1C1E24] hover:bg-[#252830] text-stone-200 hover:text-white rounded-lg active:scale-95 transition-all text-xs font-sans font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm border border-white/5 cursor-pointer"
          title="Download the currently edited ABC notation"
        >
          <Download size={14} className="text-[#4F46E5]" />
          Download ABC File
        </button>

        {/* Collapsible Parser Warnings Banner */}
        {warnings.length > 0 && (
          <div className="border border-red-500/20 rounded-lg bg-red-500/10 overflow-hidden shadow-sm mt-auto">
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
