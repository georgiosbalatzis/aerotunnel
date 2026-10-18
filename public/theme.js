// Shared F1 STORIES preference; blocking head script owns first paint and live theme state.
(() => {
  const KEY = 'f1stories-theme';
  const root = document.documentElement;
  const backgrounds = { light: '#f2eee4', dark: '#1b1a19' };
  const valid = value => value === 'light' || value === 'dark';
  const listeners = new Set();
  let media;
  try { media = window.matchMedia?.('(prefers-color-scheme: light)'); } catch { /* OS preference unavailable */ }

  function readPreference() {
    try {
      const value = localStorage.getItem(KEY);
      if (valid(value)) return value;
    } catch { /* Try the canonical session fallback. */ }
    try {
      const value = sessionStorage.getItem(KEY);
      if (valid(value)) {
        try {
          localStorage.setItem(KEY, value);
          sessionStorage.removeItem(KEY);
        } catch { /* Keep the session preference when persistent storage fails. */ }
        return value;
      }
    } catch { /* Use the OS preference. */ }
    return null;
  }

  let preference = readPreference();
  const systemTheme = () => media?.matches ? 'light' : 'dark';
  let mode = preference || systemTheme();

  function apply(next) {
    root.dataset.theme = next;
    root.style.colorScheme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', backgrounds[next]);
    if (mode === next) return;
    mode = next;
    listeners.forEach(listener => listener());
  }

  function toggle() {
    preference = mode === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, preference);
      try { sessionStorage.removeItem(KEY); } catch { /* Persistent preference is already saved. */ }
    } catch {
      try { sessionStorage.setItem(KEY, preference); } catch { /* Keep the explicit choice in memory. */ }
    }
    apply(preference);
  }

  window.aeroTunnelTheme = {
    getSnapshot: () => mode,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toggle,
  };
  apply(mode);

  const followSystem = () => { if (!preference) apply(systemTheme()); };
  if (media?.addEventListener) media.addEventListener('change', followSystem);
  else media?.addListener?.(followSystem);
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    preference = readPreference();
    apply(preference || systemTheme());
  });
})();
