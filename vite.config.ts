import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite configuration file.
// `dist` is the folder Vercel will publish. The service worker is registered
// from the site root, so we keep a relative base ("/") which works on any host.
// The automatic checks are built as plain scripts, so they do not need the
// icons and manifest copied next to them.
const skipPublic =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SKIP_PUBLIC === '1'

export default defineConfig({
  publicDir: skipPublic ? false : 'public',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
