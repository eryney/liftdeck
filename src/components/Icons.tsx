const p = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconToday = () => (
  <svg viewBox="0 0 24 24" {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconChains = () => (
  <svg viewBox="0 0 24 24" {...p}>
    <path d="M5 19h4M5 14h8M5 9h11M5 4h14" />
    <path d="M19 15l-3 3 1.5 1.5L21 16" />
  </svg>
);

export const IconHistory = () => (
  <svg viewBox="0 0 24 24" {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSettings = () => (
  <svg viewBox="0 0 24 24" {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
    <circle cx="9" cy="7" r="2" fill="var(--bg)" />
    <circle cx="15" cy="12" r="2" fill="var(--bg)" />
    <circle cx="8" cy="17" r="2" fill="var(--bg)" />
  </svg>
);
