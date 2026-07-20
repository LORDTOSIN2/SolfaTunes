// Safeguard against browser and chrome extension polyfill errors in iframes
if (typeof window !== 'undefined') {
  try {
    const mockGetManifest = () => ({ version: "1.0.0", name: "SafeMock", manifest_version: 3 });
    const patchRuntime = (obj: any) => {
      if (!obj) return;
      try {
        if (!obj.runtime) {
          Object.defineProperty(obj, 'runtime', {
            value: {},
            writable: true,
            configurable: true
          });
        }
        if (obj.runtime && typeof obj.runtime.getManifest !== 'function') {
          Object.defineProperty(obj.runtime, 'getManifest', {
            value: mockGetManifest,
            writable: true,
            configurable: true
          });
        }
      } catch (err) {
        if (obj.runtime && !obj.runtime.getManifest) {
          try { obj.runtime.getManifest = mockGetManifest; } catch (e) {}
        }
      }
    };

    if (!(window as any).browser) {
      try {
        Object.defineProperty(window, 'browser', {
          value: {},
          writable: true,
          configurable: true
        });
      } catch (e) {
        (window as any).browser = {};
      }
    }
    patchRuntime((window as any).browser);

    if (!(window as any).chrome) {
      try {
        Object.defineProperty(window, 'chrome', {
          value: {},
          writable: true,
          configurable: true
        });
      } catch (e) {
        (window as any).chrome = {};
      }
    }
    patchRuntime((window as any).chrome);
  } catch (e) {
    console.warn("Could not patch chrome/browser runtime mocks:", e);
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
