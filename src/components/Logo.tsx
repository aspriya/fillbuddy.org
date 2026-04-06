/**
 * FillBuddy logomark — pen writing "PDF".
 * Renders as white text + dark pen on transparent background.
 * Wrap in a colored container as needed.
 */
export default function Logo({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* "PDF" text */}
      <text
        x="55" y="360"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="200"
        fill="white"
        opacity="0.95"
        transform="rotate(-8, 170, 310)"
        letterSpacing="-4"
      >PDF</text>
      {/* Underline */}
      <line x1="35" y1="385" x2="315" y2="345" stroke="white" strokeWidth="8" strokeLinecap="round" opacity="0.7" />
      {/* Pen */}
      <g transform="translate(280, 138) rotate(40) scale(1.35)">
        <rect x="-20" y="-160" width="40" height="200" rx="4" fill="#1a1a1a" />
        <rect x="-22" y="20" width="44" height="40" rx="3" fill="#292929" />
        <line x1="-22" y1="30" x2="22" y2="30" stroke="#444" strokeWidth="2" />
        <line x1="-22" y1="38" x2="22" y2="38" stroke="#444" strokeWidth="2" />
        <line x1="-22" y1="46" x2="22" y2="46" stroke="#444" strokeWidth="2" />
        <polygon points="-16,60 16,60 0,105" fill="#1a1a1a" />
        <polygon points="-8,80 8,80 0,105" fill="#666" />
        <polygon points="-3,95 3,95 0,108" fill="#333" />
        <rect x="-20" y="-170" width="40" height="18" rx="4" fill="#333" />
        <rect x="18" y="-168" width="6" height="70" rx="3" fill="#444" />
        <circle cx="21" cy="-100" r="5" fill="#555" />
      </g>
    </svg>
  );
}
