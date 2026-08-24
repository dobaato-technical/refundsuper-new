"use client";
/**
 * refundmysuper wordmark — simple text lockup matching the brand asset.
 * Lowercase, tight tracking, deep-blue on light backgrounds and white on dark.
 * The mascot itself is used as a hero illustration (see LandingClient), not as
 * a header icon — the wordmark carries the header lockup.
 */
export default function BrandLogo({ variant = "dark", size = "md", className = "" }) {
  const sizeClass = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  }[size] || "text-2xl";
  const color = variant === "light" ? "text-white" : "text-[#014E87]";
  const accent = variant === "light" ? "text-[#D5A31B]" : "text-[#0076C2]";
  return (
    <span
      role="img"
      aria-label="refundmysuper"
      className={`font-display font-bold tracking-tight leading-none inline-flex items-baseline ${sizeClass} ${className}`}
    >
      <span className={color}>refund</span>
      <span className={accent}>my</span>
      <span className={color}>super</span>
    </span>
  );
}
