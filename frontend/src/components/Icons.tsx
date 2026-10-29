import type { SVGProps } from "react";

type IconName =
  | "dashboard" | "upload" | "queue" | "invoices" | "scan" | "match" | "shield" | "vendors"
  | "po" | "grn" | "approval" | "audit" | "model" | "users" | "settings" | "search" | "x" | "check"
  | "alert" | "download" | "external" | "copy" | "refresh" | "filter" | "arrow-right" | "arrow-left"
  | "arrow-up-right" | "lock" | "logout" | "bell" | "menu" | "file" | "plus" | "play" | "info"
  | "clock" | "chevron-right" | "chevron-down" | "trend" | "sparkles" | "building" | "banknote"
  | "eye" | "ban" | "flag" | "list" | "grid" | "shield-check" | "circle-check" | "circle-x" | "database" | "inbox";

const PATHS: Record<IconName, string> = {
  dashboard: "M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z",
  upload: "M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16",
  queue: "M4 6h16M4 12h16M4 18h10",
  invoices: "M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16",
  match: "M9 4v5H4M15 20v-5h5M4 9l6 0 3 3M20 15l-6 0-3-3",
  shield: "M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z",
  vendors: "M4 21V9l8-5 8 5v12M9 21v-6h6v6M4 21h16",
  po: "M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4M10 16h2",
  grn: "M3 8l9-4 9 4-9 4zM3 8v8l9 4 9-4V8M12 12v8",
  approval: "M9 12l2 2 4-4M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z",
  audit: "M9 4h6M7 4h10v16H7zM9 9h6M9 13h6M9 17h4",
  model: "M4 18V9M9.3 18V5M14.7 18v-7M20 18V7",
  users: "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1.5a4 4 0 0 0-3-3.87M16.5 3.6a3.5 3.5 0 0 1 0 6.8",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  x: "M6 6l12 12M18 6L6 18",
  check: "M4 12.5l5 5L20 6",
  alert: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  download: "M12 4v12m0 0l-4-4m4 4l4-4M4 20h16",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  copy: "M9 9h10v12H9zM5 15V3h10",
  refresh: "M20 11a8 8 0 1 0-2.3 6M20 4v7h-7",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  "arrow-right": "M4 12h16M14 6l6 6-6 6",
  "arrow-left": "M20 12H4M10 18l-6-6 6-6",
  "arrow-up-right": "M7 17L17 7M9 7h8v8",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  logout: "M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9",
  bell: "M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  menu: "M4 7h16M4 12h16M4 17h16",
  file: "M6 3h9l4 4v14H6zM15 3v5h4",
  plus: "M12 5v14M5 12h14",
  play: "M8 5l11 7-11 7z",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5M12 8h.01",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  "chevron-right": "M9 6l6 6-6 6",
  "chevron-down": "M6 9l6 6 6-6",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  sparkles: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7z",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M7 8h5M7 12h5M7 16h5",
  banknote: "M2 7h20v10H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 10v0M19 14v0",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ban: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM5 5l14 14",
  flag: "M5 21V4h9l-1 3h6l-2 5 2 5h-6l-1-3H5",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  "shield-check": "M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6zM9 11.5l2 2 4-4",
  "circle-check": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 12l3 3 5-6",
  "circle-x": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 9l6 6M15 9l-6 6",
  inbox: "M4 13h4l2 3h4l2-3h4M5 5h14l1 8v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4z",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type { IconName };
