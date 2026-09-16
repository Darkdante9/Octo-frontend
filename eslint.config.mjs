import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// Flat config (ESLint 9). Without this file the `lint` script cannot run at all, since
// eslint-config-next is only reachable through a config the flat loader can find.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
  {
    // Warn, don't error. This rule also fires on two patterns that are correct here: reading the
    // theme the pre-paint script stamped on <html> (the server cannot know it, so the first read
    // must happen in an effect), and flipping a loading flag before an async fetch. Left visible
    // so genuine prop-copying still gets caught in review.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
]);

export default eslintConfig;
