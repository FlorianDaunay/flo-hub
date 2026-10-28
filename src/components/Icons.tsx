import type { SVGProps } from "react";
import type { Platform } from "@/lib/classify";

type P = SVGProps<SVGSVGElement>;
const base = (p: P): P => ({ width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, ...p });

export const GlobeIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
  </svg>
);
export const AndroidIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 16V11a7 7 0 0 1 14 0v5H5Z" />
    <path d="M7.5 5.5 6 3.5M16.5 5.5 18 3.5M9 9.5h.01M15 9.5h.01M8 16v3M16 16v3" />
  </svg>
);
export const WindowsIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5.5 11 4.5v7H4zM13 4.2l7-1v8.3h-7zM4 13.5h7v6l-7-1zM13 13.5h7v7.3l-7-1z" />
  </svg>
);
export const LinuxIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3c-2.2 0-3.3 1.8-3.3 4.2 0 1.6-.6 2.7-1.7 4.3C5.8 13.2 5 15 5.5 17c.4 1.7 2.2 3 6.5 3s6.1-1.3 6.5-3c.5-2-.3-3.8-1.5-5.5-1.1-1.6-1.7-2.7-1.7-4.3C15.3 4.8 14.2 3 12 3Z" />
    <path d="M10.3 8h.01M13.7 8h.01M10.5 10.5c.9.6 2.1.6 3 0" />
  </svg>
);
export const AppleIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M16.5 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8C7 7.3 5.5 8.2 4.7 9.7c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.8 2.1-1.2 2.9-2.3c.9-1.3 1.3-2.6 1.3-2.7 0 0-2.8-1-2.8-4.1ZM14.2 5.4c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3Z" />
  </svg>
);
export const GithubIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  </svg>
);
export const DownloadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" />
  </svg>
);
export const ArrowIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
export const CubeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12v9M12 12 4 7.5" />
  </svg>
);
export const GridIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);
export const PaletteIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.3-1.7-.4-1.1.3-2.3 1.5-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z" />
    <path d="M7.5 11h.01M10 7h.01M15 7h.01" strokeWidth={2.6} />
  </svg>
);
export const StarIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
  </svg>
);

export const MapIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Zm0 0v14m6-12v14" />
  </svg>
);
export const SoundIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 10v4h4l5 4V6L8 10H4Zm12.5-1.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);
export const MuteIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 10v4h4l5 4V6L8 10H4Zm12 0 5 5m0-5-5 5" />
  </svg>
);

export const PLATFORM_ICON: Record<Platform, (p: P) => JSX.Element> = {
  web: GlobeIcon,
  android: AndroidIcon,
  windows: WindowsIcon,
  linux: LinuxIcon,
  macos: AppleIcon,
};
