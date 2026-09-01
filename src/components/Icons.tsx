const p = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'square' as const,
  strokeLinejoin: 'miter' as const,
};

export const IconToday = () => (
  <svg viewBox="0 0 24 24" {...p}>
    <rect x="4" y="5" width="16" height="15" />
    <path d="M4 10h16M8 3v4M16 3v4" />
    <rect x="10" y="13" width="4" height="4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCalendar = () => (
  <svg viewBox="0 0 24 24" {...p}>
    <rect x="3" y="5" width="18" height="16" />
    <path d="M3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2" />
  </svg>
);

export const IconProgress = () => (
  <svg viewBox="0 0 24 24" {...p}>
    <path d="M4 20h17M4 20V4" />
    <path d="M7 16l4-5 3 2 5-7" />
  </svg>
);

export const IconPlan = () => (
  <svg viewBox="0 0 24 24" {...p}>
    <path d="M5 4h14v17H5z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
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
