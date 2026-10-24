/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppSettings {
  // View Visibility Toggles
  showLivePreview: boolean;          // Default: false (as requested)
  showSidebar: boolean;              // Default: true
  showPianoRoll: boolean;            // Default: false
  showPlaybackDock: boolean;         // Default: true
  showReferenceLegend: boolean;      // Default: false
  zenMode: boolean;                  // Default: false (distraction-free view)
  pianoRollGridOpacity: number;      // Default: 0.08 (faint grid)

  // Editor & Display Preferences
  autoFormatOnBlur: boolean;         // Default: true
  soundPreviewOnClick: boolean;      // Default: true
  colorCodedVoices: boolean;         // Default: true
  showCompilationWarnings: boolean;  // Default: true
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  showLivePreview: false,            // Off by default
  showSidebar: true,
  showPianoRoll: false,
  showPlaybackDock: true,
  showReferenceLegend: false,
  zenMode: false,
  pianoRollGridOpacity: 0.08,
  autoFormatOnBlur: true,
  soundPreviewOnClick: true,
  colorCodedVoices: true,
  showCompilationWarnings: true,
};

const SETTINGS_STORAGE_KEY = 'solfatunes_user_settings_v1';

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw);
    const gridOpacity = parsed.pianoRollGridOpacity;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      // Ensure live preview stays off by default if unconfigured or requested
      showLivePreview: parsed.showLivePreview ?? false,
      pianoRollGridOpacity:
        typeof gridOpacity === 'number' && Number.isFinite(gridOpacity)
          ? Math.min(0.4, Math.max(0, gridOpacity))
          : DEFAULT_APP_SETTINGS.pianoRollGridOpacity,
    };
  } catch (e) {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // LocalStorage quota or access error handled gracefully
  }
}
