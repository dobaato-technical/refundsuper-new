/**
 * refundmysuper wordmark — the brand logo asset (public/brand/logo.png).
 * `variant="dark"` (default) is the navy/blue-on-transparent original, for
 * light backgrounds. `variant="light"` swaps to the white knockout
 * (public/brand/logo-white.png) for dark backgrounds (e.g. the footer).
 * The mascot itself is used as a hero illustration (see LandingClient), not
 * as a header icon — the wordmark carries the header lockup.
 */
const HEIGHT_CLASS = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
};

export default function BrandLogo({ variant = "dark", size = "md", className = "" }) {
  const src = variant === "light" ? "/brand/logo-white.png" : "/brand/logo.png";
  const heightClass = HEIGHT_CLASS[size] || HEIGHT_CLASS.md;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="refundmysuper"
      className={`w-auto ${heightClass} ${className}`}
    />
  );
}
