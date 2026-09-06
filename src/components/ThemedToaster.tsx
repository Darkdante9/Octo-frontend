"use client";

import { Toaster } from "sonner";
import { useTheme } from "./ThemeProvider";

/** Sonner needs the theme as a prop, so it lives in a client component reading the context. */
export function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-center" richColors />;
}
