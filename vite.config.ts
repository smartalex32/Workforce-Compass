import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  // PGlite loads WASM and data files from its installed package.
  environments: {
    rsc: { resolve: { external: ['@electric-sql/pglite', 'pg'] } },
  },
  // macOS Seatbelt blocks FSEvents for local Codex previews.
  server:
    process.env.CODEX_SANDBOX === 'seatbelt'
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
  plugins: [vinext()],
});
