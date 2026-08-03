"use client";

import { useEffect, useState } from "react";

/**
 * Temporary celebration ticker — auto-hides after EXPIRES_AT.
 * Added 2026-08-03; visible for ~10 days.
 */
const EXPIRES_AT = new Date("2026-08-13T23:59:59+02:00");

const MESSAGE =
  "Congratulations MAAZ on securing admission to the University! 🎉 Your hard work has truly paid off. Wishing you all the best for this exciting new chapter ahead!";

export function CongratsTicker() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(Date.now() < EXPIRES_AT.getTime());
  }, []);

  if (!visible) return null;

  return (
    <div
      className="congrats-ticker relative z-[60] overflow-hidden border-b border-amber-700/30 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-amber-950 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="congrats-ticker-track flex w-max items-center gap-16 py-2.5 text-sm font-semibold tracking-wide sm:text-base">
        <span className="congrats-ticker-pulse whitespace-nowrap px-4">
          {MESSAGE}
        </span>
        <span className="congrats-ticker-pulse whitespace-nowrap px-4" aria-hidden>
          {MESSAGE}
        </span>
        <span className="congrats-ticker-pulse whitespace-nowrap px-4" aria-hidden>
          {MESSAGE}
        </span>
      </div>
    </div>
  );
}
