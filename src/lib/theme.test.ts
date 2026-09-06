import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY, DEFAULT_THEME } from "./theme";

// The pre-paint theme script is allowlisted in the strict CSP by hash rather than nonce, so the
// two must stay in lockstep. If this fails, recompute the hash and update THEME_SCRIPT_HASH in
// src/proxy.ts — otherwise the script is silently blocked on /dashboard/wallets/* and those pages
// flash the wrong theme on every load.
describe("theme init script CSP hash", () => {
  it("matches the hash allowlisted in proxy.ts", () => {
    const actual = createHash("sha256").update(THEME_INIT_SCRIPT, "utf8").digest("base64");
    const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
    const declared = proxy.match(/'sha256-([A-Za-z0-9+/=]+)'/)?.[1];

    expect(declared, "no THEME_SCRIPT_HASH found in src/proxy.ts").toBeDefined();
    expect(actual).toBe(declared);
  });

  it("sets data-theme from storage, falling back to the system preference", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT).toContain("prefers-color-scheme: light");
    expect(THEME_INIT_SCRIPT).toContain("data-theme");
    expect(THEME_INIT_SCRIPT).toContain(`"${DEFAULT_THEME}"`);
  });
});
