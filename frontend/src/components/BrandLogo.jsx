"use client";
/**
 * Super Refund Australia brand mark — Australia silhouette with a rising arrow
 * and a rupee accent. Renders inline SVG so it stays crisp at any size and is
 * cacheable with the HTML shell (no external network round-trip).
 */
export default function BrandLogo({ size = 36, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Super Refund Australia"
      className={className}
    >
      {/* Rounded background — Deep Blue */}
      <rect x="0" y="0" width="64" height="64" rx="14" fill="#014E87" />
      {/* Stylised Australia silhouette (simplified path) — Accent Blue */}
      <path
        d="M18 26c1.5-4 5-7 9-7 4 0 6 2 9 2 3 0 5-2 8-2 3 0 5 2 4 5-1 3-4 5-4 8 0 3 3 4 3 7 0 4-4 6-8 6-4 0-6-3-10-3-4 0-6 3-10 2-4-1-6-5-5-9 1-3 3-5 4-9z"
        fill="#0076C2"
        opacity="0.9"
      />
      {/* Rising arrow — Warm Gold */}
      <path
        d="M22 44 L32 34 L38 38 L46 26"
        stroke="#D5A31B"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arrow head */}
      <path
        d="M42 22 L48 22 L48 28"
        stroke="#D5A31B"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Rupee dot accent (small glyph corner) — White */}
      <circle cx="46" cy="46" r="6.5" fill="#FFFFFF" />
      <text
        x="46"
        y="50"
        textAnchor="middle"
        fill="#014E87"
        fontSize="10"
        fontFamily="Manrope, sans-serif"
        fontWeight="700"
      >
        ₹
      </text>
    </svg>
  );
}
