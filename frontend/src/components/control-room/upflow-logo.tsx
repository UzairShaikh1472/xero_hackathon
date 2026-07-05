export function UpFlowLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#1a1a1a" />
      <text x="7" y="22" fontSize="15" fontWeight="700" fill="#a3e635" fontFamily="Georgia, serif">£</text>
      <path d="M21 15.5 L25.5 15.5 M23.2 13.2 L25.8 15.5 L23.2 17.8" stroke="#a3e635" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
