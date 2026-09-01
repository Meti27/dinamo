import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static single-page build. No server, no SSR, no router — the whole site is
// one page plus a folder of frames.
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    // the frame sequence is fetched at runtime from /frames, never bundled
    assetsInlineLimit: 0,
  },
});
