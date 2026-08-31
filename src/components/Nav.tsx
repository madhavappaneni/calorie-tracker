import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

/** One nav element: fixed bottom tab bar on phones, top bar from 640px up (spec §3.1).
 *  Position:fixed keeps it out of flow, so a single DOM node serves both layouts. */
export function Nav() {
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        <span className="wordmark">Macros</span>
        <div className="nav-links">
          <Item to="/" label="Today" icon={<CalendarIcon />} />
          <Item to="/library" label="Library" icon={<ListIcon />} />
          <Item to="/review" label="Review" icon={<ChartIcon />} />
          <Item to="/settings" label="Settings" icon={<SlidersIcon />} />
        </div>
      </div>
    </nav>
  );
}

function Item({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'nav-link on' : 'nav-link')}>
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

const svg = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const CalendarIcon = () => (
  <svg {...svg}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4" />
  </svg>
);

const ListIcon = () => (
  <svg {...svg}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

const ChartIcon = () => (
  <svg {...svg}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

const SlidersIcon = () => (
  <svg {...svg}>
    <path d="M4 6h16M4 12h16M4 18h16" />
    <circle cx="9" cy="6" r="2" />
    <circle cx="15" cy="12" r="2" />
    <circle cx="7" cy="18" r="2" />
  </svg>
);
