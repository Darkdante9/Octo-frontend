"use client";

import { useRef } from "react";
import { useTheme } from "./ThemeProvider";

/**
 * Light/dark switch. Both icons are always rendered and swapped by CSS on `[data-theme]` rather
 * than by React state — the server can't know the theme, so a state-driven icon would hydrate
 * wrong and flicker on first paint.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { toggleTheme } = useTheme();
  const ref = useRef<HTMLButtonElement>(null);

  // The reveal expands from the button's centre, so the wipe reads as coming from the click.
  function onClick() {
    const r = ref.current?.getBoundingClientRect();
    toggleTheme(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined);
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy-bright ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="theme-icon-sun h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className="theme-icon-moon h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    </button>
  );
}
