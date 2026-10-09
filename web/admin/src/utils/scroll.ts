/**
 * Utility to force scroll position of all potential scrolling containers (window, documentElement, body, #root) to top.
 * Retries across multiple animation frames and timeouts to handle React Suspense code-splitting,
 * Framer Motion layout animations, and DOM rendering/measurement delays.
 */
export const forceScrollTop = () => {
  if (typeof window === 'undefined') return () => {};

  // Disable browser automatic scroll restoration so it won't override us
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  const reset = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      const root = document.getElementById('root');
      if (root) {
        root.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      }
    } catch {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  reset();

  const raf1 = requestAnimationFrame(reset);
  const raf2 = requestAnimationFrame(() => requestAnimationFrame(reset));

  const t1 = setTimeout(reset, 50);
  const t2 = setTimeout(reset, 150);
  const t3 = setTimeout(reset, 300);

  return () => {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    clearTimeout(t1);
    clearTimeout(t2);
    clearTimeout(t3);
  };
};
