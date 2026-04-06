/**
 * FillBuddy logomark — document with checkmark.
 * Renders as white paths on transparent background.
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
      {/* Document silhouette with folded corner */}
      <path
        d="M160,72 L312,72 L368,128 L368,440 C368,451 359,460 348,460 L164,460 C153,460 144,451 144,440 L144,88 C144,77 153,72 160,72 Z"
        fill="currentColor"
        opacity="0.95"
      />
      {/* Dog-ear fold */}
      <path d="M312,72 L312,128 L368,128 Z" fill="currentColor" opacity="0.5" />
      {/* Checkmark circle */}
      <circle cx="310" cy="340" r="72" fill="#16a34a" />
      {/* White checkmark */}
      <polyline
        points="274,340 300,366 346,314"
        fill="none"
        stroke="white"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
