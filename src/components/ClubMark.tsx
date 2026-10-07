export function ClubMark({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#e6bd77" fillOpacity="0.13" />
      <circle cx="32" cy="32" r="21" stroke="#e6bd77" strokeWidth="2" />
      <circle cx="32" cy="32" r="12" stroke="#e6bd77" strokeWidth="2" />
      <circle cx="32" cy="32" r="4" fill="#e6bd77" />
      <path d="M32 8v6M32 50v6M8 32h6M50 32h6" stroke="#e6bd77" strokeWidth="2" />
    </svg>
  );
}
