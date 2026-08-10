import ResizeObserverPolyfill from 'resize-observer-polyfill';

/** Safari < 13.1 / Chrome < 64: ResizeObserver no existe (core-js no lo cubre). */
if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = ResizeObserverPolyfill as typeof window.ResizeObserver;
}
