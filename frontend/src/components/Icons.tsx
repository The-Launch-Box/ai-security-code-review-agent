// Bespoke inline icons — schematic, hairline, on-brand. No icon library.
import type { CSSProperties } from 'react';
interface P {
  size?: number;
  className?: string;
  style?: CSSProperties;
}
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const Mark = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="4.5" r="1.8" />
    <circle cx="12" cy="12" r="2.4" />
    <circle cx="19" cy="12" r="1.8" />
    <circle cx="12" cy="19.5" r="1.8" />
    <path d="M12 6.3v3.3M12 14.4v3.3M14.4 12h2.8" />
    <path d="M19 10.2c1.6-.6 1.6-3.4-.4-3.4-1.4 0-2 .9-2.4 1.8" strokeDasharray="1.5 1.8" />
  </svg>
);

export const Folder = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.3l1.6 2H19.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
  </svg>
);

export const Git = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="6" cy="6" r="2.2" />
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="9" r="2.2" />
    <path d="M6 8.2v7.6M8.1 7.1c4 1 6 2 7.9 1.4" />
    <path d="M18 11.2c0 4-4 4.5-9.8 4.8" strokeDasharray="1.5 1.8" />
  </svg>
);

export const Bolt = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M13 2 4.5 13.2h6L9.5 22 19.5 9.8h-6.2z" />
  </svg>
);

export const Cube = ({ size = 16, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 3 20 7.5v9L12 21 4 16.5v-9z" />
    <path d="M4 7.5 12 12l8-4.5M12 12v9" />
  </svg>
);

export const Pulse = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 12h4l2-6 4 12 2-6h6" />
  </svg>
);

export const Layers = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3 3 8l9 5 9-5z" />
    <path d="M3 13l9 5 9-5M3 16.5l9 5 9-5" />
  </svg>
);

export const Doc = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4M9 12h6M9 15.5h6M9 8.5h2" />
  </svg>
);

export const Scope = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);
