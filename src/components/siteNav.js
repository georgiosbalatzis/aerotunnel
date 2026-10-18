// Canonical labels from f1StoriesPage/partials/nav.html; standalone destinations verified in Phase 04.
export const SITE_URL = 'https://f1-stories.gr';
export const SITE_NAV_LINKS = [
  { label: 'Αρχική', href: `${SITE_URL}/` },
  { label: 'Άρθρα', href: `${SITE_URL}/blog-module/blog/index.html` },
  { label: 'YouTube', href: 'https://www.youtube.com/@f1_stories_original', external: true },
  { label: 'Βαθμολογία', href: `${SITE_URL}/standings/` },
  { label: 'Δεδομένα', href: `${SITE_URL}/standings/?tab=tyre-pace` },
  { label: 'Συντάκτες', href: `${SITE_URL}/authors/` },
  { label: 'BetCast', href: 'https://georgiosbalatzis.github.io/BetCastVisualisation/', external: true },
];

export const RACE_DESK_LINKS = [
  { label: 'THE GRID', href: `${SITE_URL}/standings/` },
  { label: 'TELEMETRY', href: 'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/' },
  { label: 'GHOST CAR', href: 'https://georgiosbalatzis.github.io/ghostcar/' },
  { label: 'TYRES', href: 'https://georgiosbalatzis.github.io/Tyres/' },
  { label: 'AEROTUNNEL', current: true },
];
