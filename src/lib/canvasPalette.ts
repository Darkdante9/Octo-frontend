/**
 * Bridges CSS theme tokens into the <canvas> scenes.
 *
 * Canvas draw calls can't be reached by a stylesheet, so the underwater scenes read their colours
 * from `--canvas-*` in globals.css at runtime. Both scenes dereference their palette object inside
 * the draw loop, so mutating it in place retheme s them on the very next frame — no remount, no
 * re-init, and no reset of octopus positions.
 */

export type Rgb = [number, number, number];

export type CanvasPalette = {
  brand: Rgb;
  gold: Rgb;
  wash: Rgb;
  deep: Rgb;
  highlight: Rgb;
  shadow: Rgb;
  octoAlpha: number;
  bubbleAlpha: number;
  /** Light mode inverts several decisions — bubbles get outlines, glows become contours. */
  isLight: boolean;
};

const FALLBACK: CanvasPalette = {
  brand: [184, 31, 77],
  gold: [240, 196, 110],
  wash: [123, 23, 51],
  deep: [10, 5, 6],
  highlight: [255, 255, 255],
  shadow: [20, 4, 10],
  octoAlpha: 0.22,
  bubbleAlpha: 1,
  isLight: false,
};

function triplet(styles: CSSStyleDeclaration, name: string, fallback: Rgb): Rgb {
  const parts = styles.getPropertyValue(name).trim().split(/[\s,]+/).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n))
    ? (parts as Rgb)
    : fallback;
}

function scalar(styles: CSSStyleDeclaration, name: string, fallback: number): number {
  const n = Number(styles.getPropertyValue(name).trim());
  return Number.isFinite(n) ? n : fallback;
}

export function readCanvasPalette(): CanvasPalette {
  if (typeof window === "undefined") return { ...FALLBACK };
  const el = document.documentElement;
  const s = getComputedStyle(el);
  return {
    brand: triplet(s, "--canvas-brand", FALLBACK.brand),
    gold: triplet(s, "--canvas-gold", FALLBACK.gold),
    wash: triplet(s, "--canvas-wash", FALLBACK.wash),
    deep: triplet(s, "--canvas-deep", FALLBACK.deep),
    highlight: triplet(s, "--canvas-highlight", FALLBACK.highlight),
    shadow: triplet(s, "--canvas-shadow", FALLBACK.shadow),
    octoAlpha: scalar(s, "--canvas-octo-alpha", FALLBACK.octoAlpha),
    bubbleAlpha: scalar(s, "--canvas-bubble-alpha", FALLBACK.bubbleAlpha),
    isLight: el.getAttribute("data-theme") === "light",
  };
}

/**
 * Re-reads the palette into `target` whenever the theme flips. Returns an unsubscribe.
 *
 * `onChange` matters for the reduced-motion path: those scenes draw a single static frame, so
 * without an explicit redraw they'd stay on the previous theme's colours indefinitely.
 */
export function watchCanvasPalette(
  target: CanvasPalette,
  onChange?: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const sync = () => {
    Object.assign(target, readCanvasPalette());
    onChange?.();
  };
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

/** `rgba(...)` from a triplet, with per-channel deltas for deriving lighter/darker shades. */
export function rgba(c: Rgb, alpha: number, shift = 0): string {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + shift)));
  return `rgba(${ch(c[0])}, ${ch(c[1])}, ${ch(c[2])}, ${alpha})`;
}

/**
 * Separates a colour from the page background.
 *
 * On dark that means lightening; on light it means darkening. The canvases were written with the
 * dark-mode assumption baked in as literal `+30` channel offsets, so this flips that sign rather
 * than hardcoding it.
 */
export function separate(p: CanvasPalette, c: Rgb, amount: number, alpha: number): string {
  return rgba(c, alpha, p.isLight ? -amount : amount);
}
