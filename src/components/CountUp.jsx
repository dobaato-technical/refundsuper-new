"use client";
import { useEffect, useRef, useState } from "react";
import { formatAUD } from "@/lib/format";

export default function CountUp({ value, duration = 1400, className = "" }) {
  const [display, setDisplay] = useState(0);
  const start = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    start.current = null;
    cancelAnimationFrame(raf.current);
    const startVal = 0;
    const endVal = Number(value) || 0;
    const step = (ts) => {
      if (!start.current) start.current = ts;
      const elapsed = ts - start.current;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(startVal + (endVal - startVal) * eased);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return (
    <span className={`count-up ${className}`} data-testid="count-up">
      {formatAUD(display)}
    </span>
  );
}
