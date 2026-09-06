"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  storedTheme,
  systemTheme,
  type Theme,
} from "@/lib/theme";

/** Where the reveal animation expands from — the toggle's centre, in viewport coordinates. */
export type RevealOrigin = { x: number; y: number };

type ThemeContextValue = {
  theme: Theme;
  setTheme: (next: Theme, origin?: RevealOrigin) => void;
  toggleTheme: (origin?: RevealOrigin) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/** Reads what the pre-paint script already stamped, so React state matches the painted DOM. */
function domTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Cross-fade fallback: colour transitions are enabled only for the duration of the swap. */
function crossFade(commit: () => void) {
  const root = document.documentElement;
  root.classList.add("theme-transitioning");
  commit();
  window.setTimeout(() => root.classList.remove("theme-transitioning"), 300);
}

/** Circular wipe from the toggle, falling back to a cross-fade without View Transitions. */
function revealSwap(commit: () => void, origin?: RevealOrigin) {
  if (prefersReducedMotion()) {
    commit();
    return;
  }
  if (!origin || typeof document.startViewTransition !== "function") {
    crossFade(commit);
    return;
  }

  const transition = document.startViewTransition(commit);
  transition.ready
    .then(() => {
      const { x, y } = origin;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
        },
        {
          duration: 520,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    // A skipped or unsupported transition still commits the theme; only the animation is lost.
    .catch(() => {});
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  // Read once per swap rather than per render, so the OS listener never uses a stale value.
  const themeRef = useRef<Theme>(DEFAULT_THEME);

  const apply = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    themeRef.current = next;
    setThemeState(next);
  }, []);

  // The server can't know the theme, so this is React's first read of what the script stamped.
  useEffect(() => {
    const initial = domTheme();
    themeRef.current = initial;
    setThemeState(initial);
  }, []);

  // Follow the OS, but only while the user has never chosen a theme explicitly.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (storedTheme()) return;
      apply(systemTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [apply]);

  const setTheme = useCallback(
    (next: Theme, origin?: RevealOrigin) => {
      if (next === themeRef.current) return;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // A blocked or full localStorage shouldn't stop the theme from changing for this session.
      }
      revealSwap(() => apply(next), origin);
    },
    [apply],
  );

  const toggleTheme = useCallback(
    (origin?: RevealOrigin) => {
      setTheme(themeRef.current === "dark" ? "light" : "dark", origin);
    },
    [setTheme],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
