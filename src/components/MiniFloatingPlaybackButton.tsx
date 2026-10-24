/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, Square } from 'lucide-react';
import { Tooltip } from './Tooltip';

export interface MiniFloatingPlaybackButtonProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  currentTick?: number;
  totalTicks?: number;
  scoreTitle?: string;
}

/**
 * Tiny floating circular playback button that acts as a play/stop toggle.
 * Displayed whenever the main bottom floating playback dock is hidden (especially in full screen modes).
 */
export const MiniFloatingPlaybackButton: React.FC<MiniFloatingPlaybackButtonProps> = ({
  isPlaying,
  onPlay,
  onStop,
  currentTick = 0,
  totalTicks = 0,
  scoreTitle,
}) => {
  const progressPercent =
    totalTicks > 0 ? Math.min(100, Math.max(0, (currentTick / totalTicks) * 100)) : 0;

  // SVG circular progress ring metrics (radius 21px within 48x48 viewbox)
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      onStop();
    } else {
      onPlay();
    }
  };

  return (
    <aside
      aria-label="Quick Playback Toggle"
      className="fixed bottom-6 right-6 z-[60] select-none pointer-events-auto"
    >
      <Tooltip
        content={isPlaying ? 'Stop Playback' : 'Play Score'}
        description={
          isPlaying
            ? 'Click to stop playback (Space)'
            : `Play ${scoreTitle ? `"${scoreTitle}"` : 'score'} (Space)`
        }
        side="left"
      >
        <button
          type="button"
          onClick={handleClick}
          aria-label={isPlaying ? 'Stop Playback' : 'Play Score'}
          className={`relative group flex items-center justify-center w-12 h-12 rounded-full shadow-2xl transition-all duration-200 cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#0A0A0B] ${
            isPlaying
              ? 'bg-gradient-to-tr from-amber-600 to-rose-600 text-white shadow-rose-950/60 ring-2 ring-rose-400/80 animate-pulse'
              : 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-indigo-950/70 hover:from-indigo-500 hover:to-violet-500 hover:scale-105 border border-white/20'
          }`}
        >
          {/* Circular progress track & active progress ring */}
          {totalTicks > 0 && (
            <svg
              className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-[2px]"
              viewBox="0 0 48 48"
            >
              <circle
                cx="24"
                cy="24"
                r={radius}
                className="stroke-white/15 fill-transparent"
                strokeWidth="2.5"
              />
              {isPlaying && (
                <circle
                  cx="24"
                  cy="24"
                  r={radius}
                  className="stroke-white fill-transparent transition-[stroke-dashoffset] duration-75 ease-linear"
                  strokeWidth="2.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              )}
            </svg>
          )}

          {/* Central Play/Stop Icon */}
          <span className="relative z-10 flex items-center justify-center">
            {isPlaying ? (
              <Square size={16} className="fill-white" />
            ) : (
              <Play size={18} className="fill-white ml-0.5" />
            )}
          </span>
        </button>
      </Tooltip>
    </aside>
  );
};
