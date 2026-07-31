"use client";
/**
 * Renders a JSON-LD `<script>` at the location where it's mounted.
 * Page-level <title>, description, Open Graph tags are now handled by Next.js
 * `metadata` exports in individual page.jsx files.
 */
export default function SEO({ jsonLd }) {
  if (!jsonLd) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
