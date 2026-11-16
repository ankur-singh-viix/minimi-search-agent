type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5" />
    </svg>
  );
}

export function ComposeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 5H6.5A2.5 2.5 0 0 0 4 7.5v10A2.5 2.5 0 0 0 6.5 20h10a2.5 2.5 0 0 0 2.5-2.5V12" />
      <path d="M17.5 4.5a1.8 1.8 0 0 1 2.5 2.5L11.5 15.5 8 16l.5-3.5z" />
    </svg>
  );
}

export function SidebarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <path d="M9.5 5v14" />
    </svg>
  );
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg {...base} strokeWidth={2.4} className={className} aria-hidden="true">
      <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
    </svg>
  );
}

export function SparkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.5c.5 4.7 2.3 7 7 7.5-4.7.5-6.5 2.8-7 7.5-.5-4.7-2.3-7-7-7.5 4.7-.5 6.5-2.8 7-7.5z" />
    </svg>
  );
}
