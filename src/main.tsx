import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@simcity/tokens/tokens.css';
import '@simcity/styles/base.css';
import '@/app.css';
import { App } from '@/App';

/*
 * Dev builds of React emit a performance.measure() per component render
 * for the DevTools performance track, and the User Timing buffer keeps
 * every entry forever — a steady ~4 MB/minute "leak" of
 * PerformanceMeasure objects while playing. Prune the buffer on a timer;
 * DevTools traces record entries at emission time and are unaffected.
 * Production builds emit none of these.
 */
if (import.meta.env.DEV) {
  setInterval(() => {
    performance.clearMeasures();
    performance.clearMarks();
  }, 10000);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
