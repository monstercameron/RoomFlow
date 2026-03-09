type RoomflowLogoProps = {
  className?: string;
  compact?: boolean;
};

export function RoomflowLogo({ className, compact = false }: RoomflowLogoProps) {
  const iconSize = compact ? 40 : 48;

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="roomflow-logo-fill" x1="10" x2="54" y1="8" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(248,243,235,0.96)" />
          <stop offset="1" stopColor="rgba(248,243,235,0.72)" />
        </linearGradient>
      </defs>
      <rect
        fill="rgba(248,243,235,0.08)"
        height={iconSize}
        rx={compact ? 14 : 18}
        stroke="rgba(248,243,235,0.16)"
        strokeWidth="1.5"
        width={iconSize}
        x={(64 - iconSize) / 2}
        y={(64 - iconSize) / 2}
      />
      <path
        d="M22 39.5V28.75L32 21.75L42 28.75V39.5H35.75V32.25H28.25V39.5H22Z"
        fill="url(#roomflow-logo-fill)"
      />
      <path
        d="M28.5 18.75H43.5"
        opacity="0.9"
        stroke="rgba(248,243,235,0.88)"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <path
        d="M28.5 14H47"
        opacity="0.55"
        stroke="rgba(248,243,235,0.72)"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
      <circle cx="18" cy="18" fill="rgba(248,243,235,0.78)" r="2.5" />
      <path
        d="M18 21.5V30C18 34.1421 21.3579 37.5 25.5 37.5H42"
        opacity="0.72"
        stroke="rgba(248,243,235,0.82)"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}